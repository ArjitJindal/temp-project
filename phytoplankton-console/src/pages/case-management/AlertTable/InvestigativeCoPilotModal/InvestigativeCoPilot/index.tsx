import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import cn from 'clsx';
import { nanoid } from 'nanoid';
import RequestForm, { FormValues } from './RequestForm';
import History from './History';
import { parseQuestionResponse, QuestionResponse, QuestionResponseSkeleton } from './types';
import s from './index.module.less';
import ScrollButton from './ScrollButton';
import { calcIsScrollVisible, calcScrollPosition, itemId } from './helpers';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { COPILOT_ALERT_QUESTIONS } from '@/utils/queries/keys';
import { isLoading, isSuccess, map, useFinishedSuccessfully } from '@/utils/asyncResource';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { scrollTo, useElementSize } from '@/utils/browser';
import { useIsChanged } from '@/utils/hooks';
import { calcVisibleElements } from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/History/helpers';
import { notEmpty } from '@/utils/array';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';

interface Props {
  alertId: string;
  preloadedHistory?: (QuestionResponse | QuestionResponseSkeleton)[];
}

export default function InvestigativeCoPilot(props: Props) {
  const { alertId, preloadedHistory } = props;
  const api = useApi();
  const [history, setHistory] = useState<(QuestionResponse | QuestionResponseSkeleton)[]>([]);

  const [rootRef, setRootRef] = useState<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  const historyQuery = useQuery(COPILOT_ALERT_QUESTIONS(alertId), async () => {
    return await api.getQuestions({
      alertId: alertId,
    });
  });

  const [isScrollVisible, setScrollVisible] = useState(false);
  const [sizes, setSizes] = useState<{ [key: string]: number }>({});
  const [isBottom, setIsBottom] = useState(true);
  const [isScrollEventDisabled, setScrollEventDisabled] = useState(false);
  const [seenIds, setSeenIds] = useState<string[]>([]);

  const historyRes = map(historyQuery.data, parseQuestionResponse);
  const isHistoryLoaded = useFinishedSuccessfully(historyRes);
  useEffect(() => {
    if (isHistoryLoaded && isSuccess(historyRes)) {
      setHistory(historyRes.value);
    }
  }, [historyRes, isHistoryLoaded]);

  const itemIds: string[] = useMemo(() => {
    return history.map((x) => (x.questionType === 'SKELETON' ? null : itemId(x))).filter(notEmpty);
  }, [history]);

  const skeletonsCount: number = useMemo(() => {
    return history.reduce((acc, x) => acc + (x.questionType === 'SKELETON' ? 1 : 0), 0);
  }, [history]);

  const handleRefresh = useCallback(() => {
    setTimeout(() => {
      if (rootRef) {
        const isScrollVisible = calcIsScrollVisible(rootRef);
        const position = calcScrollPosition(rootRef);
        const isBottom = Math.abs(position) < 10;
        setIsBottom(isBottom);
        setScrollVisible(isScrollVisible);
        const newSeenIds = calcVisibleElements(itemIds, sizes, position);
        if (newSeenIds.length > seenIds.length) {
          setSeenIds(newSeenIds);
        }
      }
    }, 0);
  }, [itemIds, sizes, seenIds, rootRef]);

  const handleScrollTo = useCallback(
    (direction: 'BOTTOM' | 'TOP', smooth: boolean) => {
      if (rootRef) {
        setIsBottom(direction === 'BOTTOM');
        const top = direction === 'BOTTOM' ? rootRef.scrollHeight - rootRef.clientHeight : 0;
        if (smooth) {
          setScrollEventDisabled(true);
        }
        scrollTo(
          rootRef,
          {
            top,
            smooth,
          },
          () => {
            setScrollEventDisabled(false);
            handleRefresh();
          },
        );
      }
    },
    [rootRef, handleRefresh],
  );

  // When user is at the bottom and history size changes - scroll to the bottom again
  const historySize = useElementSize(historyRef.current);
  const isHeightChanged = useIsChanged(historySize?.height);
  useLayoutEffect(() => {
    if (isBottom && isHeightChanged) {
      handleScrollTo('BOTTOM', false);
    }
  }, [isBottom, handleScrollTo, isHeightChanged]);

  const postQuestionMutation = useMutation<unknown, unknown, FormValues[]>(
    async (requests) => {
      for (const request of requests) {
        const requestId = nanoid();
        setHistory((items) => [
          ...items,
          {
            questionType: 'SKELETON',
            requestId,
            requestString: request.searchString,
          },
        ]);
        api
          .postQuestion({
            QuestionRequest: {
              question: request.searchString,
              variables: Object.entries(DEFAULT_PARAMS_STATE)
                .filter(([_, value]) => value != null)
                .map(([name, value]) => ({ name, value })),
            },
            alertId: alertId,
          })
          .then((response) => {
            const parsedResponses = parseQuestionResponse(response);
            setHistory((items) => {
              const result: (QuestionResponse | QuestionResponseSkeleton)[] = [];
              for (const x of items) {
                if (x.questionType === 'SKELETON' && x.requestId === requestId) {
                  result.push(...parsedResponses);
                } else {
                  result.push(x);
                }
              }
              return result;
            });
          })
          .catch((error) => {
            setHistory((items) =>
              items.map((x) =>
                x.questionType === 'SKELETON' && x.requestId === requestId
                  ? { ...x, error: getErrorMessage(error) }
                  : x,
              ),
            );
          });
      }
    },
    {
      onSuccess: () => {
        if (isBottom) {
          handleScrollTo('BOTTOM', false);
        }
      },
      onError: (error) => {
        message.error(getErrorMessage(error));
      },
    },
  );

  const unreadResponses = history.length - skeletonsCount - seenIds.length;

  useEffect(() => {
    if (isScrollEventDisabled) {
      return () => {};
    }
    if (rootRef) {
      const listener = () => {
        handleRefresh();
      };
      rootRef.addEventListener('scroll', listener, { passive: true });
      return () => rootRef.removeEventListener('scroll', listener);
    }
  }, [rootRef, isScrollEventDisabled, handleRefresh]);

  const allItems = useMemo(() => {
    return preloadedHistory ? [...preloadedHistory, ...history] : history;
  }, [preloadedHistory, history]);

  const allSeenIds = useMemo(() => {
    return preloadedHistory ? [...preloadedHistory.map((x) => itemId(x)), ...seenIds] : seenIds;
  }, [preloadedHistory, seenIds]);

  const isHistoryLoading = isLoading(historyRes);
  return (
    <div className={s.root} ref={setRootRef}>
      <div className={s.history} ref={historyRef}>
        {/*<AiAlertSummary alertId={alertId} summary={'derasd'} onReload={() => {}} />*/}
        <AsyncResourceRenderer
          resource={historyRes}
          renderLoading={() => (
            <History
              alertId={alertId}
              items={[
                {
                  questionType: 'SKELETON',
                  requestId: 'loading_1',
                },
                {
                  questionType: 'SKELETON',
                  requestId: 'loading_2',
                },
              ]}
              seenItems={allSeenIds}
              setSizes={setSizes}
            />
          )}
        >
          {() => (
            <History
              alertId={alertId}
              items={allItems}
              seenItems={allSeenIds}
              setSizes={setSizes}
            />
          )}
        </AsyncResourceRenderer>
      </div>
      <div className={s.form}>
        <div className={cn(s.scrollToBottom, (!isScrollVisible || isHistoryLoading) && s.isHidden)}>
          <ScrollButton
            isBottom={isBottom}
            onScroll={handleScrollTo}
            unreadResponses={unreadResponses}
          />
        </div>
        <RequestForm
          mutation={postQuestionMutation}
          history={history}
          alertId={alertId}
          isLoading={isLoading(historyRes)}
        />
      </div>
    </div>
  );
}

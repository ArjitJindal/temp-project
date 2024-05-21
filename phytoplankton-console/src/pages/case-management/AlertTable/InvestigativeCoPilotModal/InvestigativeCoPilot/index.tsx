import React, { useEffect, useRef, useState, useCallback, useLayoutEffect, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import pluralize from 'pluralize';
import cn from 'clsx';
import { nanoid } from 'nanoid';
import RequestForm, { FormValues } from './RequestForm';
import History from './History';
import { parseQuestionResponse, QuestionResponse, QuestionResponseSkeleton } from './types';
import s from './index.module.less';
import ScrollButton from './ScrollButton';
import { calcIsScrollVisible, calcScrollPosition, itemId } from './helpers';
import dayjs, { TIME_FORMAT_WITHOUT_SECONDS } from '@/utils/dayjs';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { ALERT_ITEM, COPILOT_ALERT_QUESTIONS, CASES_ITEM } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import * as Form from '@/components/ui/Form';
import { isSuccess, map, useFinishedSuccessfully, all } from '@/utils/asyncResource';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import CaseStatusTag from '@/components/library/Tag/CaseStatusTag';
import Id from '@/components/ui/Id';
import { addBackUrlToRoute } from '@/utils/backUrl';
import { makeUrl } from '@/utils/routing';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { Case } from '@/apis';
import { TableUser } from '@/pages/case-management/CaseTable/types';
import { getUserName } from '@/utils/api/users';
import UserLink from '@/components/UserLink';
import { useElementSize, scrollTo } from '@/utils/browser';
import { useIsChanged } from '@/utils/hooks';
import { calcVisibleElements } from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/History/helpers';
import { notEmpty } from '@/utils/array';
import { humanizeAuto } from '@/utils/humanize';

interface Props {
  alertId: string;
  caseId: string;
}

export default function InvestigativeCoPilot(props: Props) {
  const { alertId, caseId } = props;
  const api = useApi();
  const [history, setHistory] = useState<(QuestionResponse | QuestionResponseSkeleton)[]>([]);

  const [rootRef, setRootRef] = useState<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  const caseQueryResults = useQuery(
    CASES_ITEM(caseId),
    (): Promise<Case> =>
      api.getCase({
        caseId,
      }),
  );

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

  const alertQueryResult = useQuery(ALERT_ITEM(alertId), async () =>
    api.getAlert({
      alertId,
    }),
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

  return (
    <AsyncResourceRenderer resource={historyRes}>
      {() => (
        <div className={s.root} ref={setRootRef}>
          <AsyncResourceRenderer resource={all([caseQueryResults.data, alertQueryResult.data])}>
            {([caseItem, alert]) => {
              const caseUsers = caseItem.caseUsers ?? {};

              const user = caseUsers?.origin?.userId
                ? caseUsers?.origin
                : caseUsers?.destination?.userId
                ? caseUsers?.destination
                : undefined;

              const caseUserName = getUserName(user as TableUser | undefined);
              const caseUserId = caseUsers?.origin?.userId ?? caseUsers?.destination?.userId ?? '';
              const paymentDetails =
                caseItem.paymentDetails?.origin ?? caseItem.paymentDetails?.destination;

              return (
                <div className={s.alertInfo}>
                  {user && 'type' in user && (
                    <>
                      <Form.Layout.Label title={'User'}>{caseUserName}</Form.Layout.Label>
                      <Form.Layout.Label title={'User ID'}>
                        <UserLink user={user}>{caseUserId}</UserLink>
                      </Form.Layout.Label>
                    </>
                  )}
                  {paymentDetails && (
                    <>
                      <Form.Layout.Label title={'Payment method'}>
                        {humanizeAuto(paymentDetails.method)}
                      </Form.Layout.Label>
                      <Form.Layout.Label title={'Payment method ID'}>
                        {caseItem.paymentMethodId ?? '-'}
                      </Form.Layout.Label>
                    </>
                  )}
                  <Form.Layout.Label title={'Alert ID'}>
                    <Id
                      to={addBackUrlToRoute(
                        makeUrl(`/case-management/case/:caseId/:tab`, {
                          caseId: alert.caseId,
                          tab: 'alerts',
                        }),
                      )}
                      testName="alert-id"
                    >
                      {alertId}
                    </Id>
                  </Form.Layout.Label>
                  <Form.Layout.Label title={'Case ID'}>
                    <Id
                      to={addBackUrlToRoute(
                        makeUrl(`/case-management/case/:caseId`, {
                          caseId: alert.caseId,
                        }),
                      )}
                      testName="case-id"
                    >
                      {alert.caseId}
                    </Id>
                  </Form.Layout.Label>
                  <Form.Layout.Label title={'Created at'}>
                    <TimestampDisplay
                      timestamp={alert.createdTimestamp}
                      timeFormat={TIME_FORMAT_WITHOUT_SECONDS}
                    />
                  </Form.Layout.Label>
                  <Form.Layout.Label title={'Priority'}>{alert.priority}</Form.Layout.Label>
                  <Form.Layout.Label title={'Alert age'}>
                    {pluralize(
                      'day',
                      Math.floor(dayjs.duration(Date.now() - alert.createdTimestamp).asDays()),
                      true,
                    )}
                  </Form.Layout.Label>
                  <Form.Layout.Label title={'TX#'}>
                    {alert.numberOfTransactionsHit}
                  </Form.Layout.Label>
                  <Form.Layout.Label title={'Alert status'}>
                    {alert.alertStatus ? <CaseStatusTag caseStatus={alert.alertStatus} /> : 'N/A'}
                  </Form.Layout.Label>
                </div>
              );
            }}
          </AsyncResourceRenderer>
          <div className={s.history} ref={historyRef}>
            <History alertId={alertId} items={history} seenItems={seenIds} setSizes={setSizes} />
          </div>
          <div className={s.form}>
            <div className={cn(s.scrollToBottom, !isScrollVisible && s.isHidden)}>
              <ScrollButton
                isBottom={isBottom}
                onScroll={handleScrollTo}
                unreadResponses={unreadResponses}
              />
            </div>
            <RequestForm mutation={postQuestionMutation} history={history} alertId={alertId} />
          </div>
        </div>
      )}
    </AsyncResourceRenderer>
  );
}

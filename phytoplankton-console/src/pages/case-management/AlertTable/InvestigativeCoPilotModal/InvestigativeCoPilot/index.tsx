import React, { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import pluralize from 'pluralize';
import cn from 'clsx';
import { uniq } from 'lodash';
import RequestForm, { FormValues } from './RequestForm';
import History from './History';
import { parseQuestionResponse, QuestionResponse } from './types';
import s from './index.module.less';
import ScrollButton from './ScrollButton';
import { useScrollState } from './helpers';
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
import Spinner from '@/components/library/Spinner';
import { useElementSize, useElementSizeChangeEffect } from '@/utils/browser';
import { useIsChanged } from '@/utils/hooks';
import { humanizeAuto } from '@/utils/humanize';

interface Props {
  alertId: string;
  caseId: string;
}

export default function InvestigativeCoPilot(props: Props) {
  const { alertId, caseId } = props;
  const api = useApi();
  const [history, setHistory] = useState<QuestionResponse[]>([]);

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

  const historyRes = map(historyQuery.data, parseQuestionResponse);
  const isHistoryLoaded = useFinishedSuccessfully(historyRes);
  useEffect(() => {
    if (isHistoryLoaded && isSuccess(historyRes)) {
      setHistory(historyRes.value);
    }
  }, [historyRes, isHistoryLoaded]);

  const [scrollState, scrollHandlers] = useScrollState(rootRef);
  const { isBottom, isScrollEventDisabled, isScrollVisible, scrollPosition } = scrollState;
  const { scroll, refresh } = scrollHandlers;

  // When user is at the bottom and history size changes - scroll to the bottom again
  const historySize = useElementSize(historyRef.current);
  const isHeightChanged = useIsChanged(historySize?.height);
  useLayoutEffect(() => {
    if (isBottom && isHeightChanged) {
      scroll('BOTTOM', false);
    }
  }, [isBottom, scroll, isHeightChanged]);

  const postQuestionMutation = useMutation<QuestionResponse[], unknown, FormValues>(
    async ({ searchString }) => {
      const response = await api.postQuestion({
        QuestionRequest: {
          question: searchString,
          variables: Object.entries(DEFAULT_PARAMS_STATE)
            .filter(([_, value]) => value != null)
            .map(([name, value]) => ({ name, value })),
        },
        alertId: alertId,
      });
      return parseQuestionResponse(response);
    },
    {
      onSuccess: (data) => {
        setHistory((prevState) => [...prevState, ...data]);
        if (isBottom) {
          scroll('BOTTOM', false);
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

  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const handleShowItems = useCallback((newVisibleIds: string[]) => {
    setVisibleIds((prevState) => uniq([...prevState, ...newVisibleIds]));
  }, []);
  const unreadResponses = history.length - visibleIds.length;

  useEffect(() => {
    if (isScrollEventDisabled) {
      return () => {};
    }
    if (rootRef) {
      rootRef.addEventListener('scroll', refresh, { passive: true });
      return () => rootRef.removeEventListener('scroll', refresh);
    }
  }, [rootRef, isScrollEventDisabled, refresh]);

  useElementSizeChangeEffect(rootRef, refresh);

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
            <History
              alertId={alertId}
              items={history}
              scrollPosition={scrollPosition}
              visibleItems={visibleIds}
              onShowItems={handleShowItems}
            />
            {postQuestionMutation.isLoading && <Spinner />}
          </div>
          <div className={s.form}>
            <div className={cn(s.scrollToBottom, !isScrollVisible && s.isHidden)}>
              <ScrollButton
                isBottom={isBottom}
                onScroll={scroll}
                unreadResponses={unreadResponses}
              />
            </div>
            <RequestForm
              mutation={postQuestionMutation}
              history={history}
              alertId={alertId}
              setHistory={setHistory}
            />
          </div>
        </div>
      )}
    </AsyncResourceRenderer>
  );
}

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import pluralize from 'pluralize';
import RequestForm, { FormValues } from './RequestForm';
import History from './History';
import { parseQuestionResponse, QuestionResponse } from './types';
import s from './index.module.less';
import dayjs, { TIME_FORMAT_WITHOUT_SECONDS } from '@/utils/dayjs';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { ALERT_ITEM, COPILOT_ALERT_QUESTIONS } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import * as Form from '@/components/ui/Form';
import { isSuccess, map, useFinishedSuccessfully } from '@/utils/asyncResource';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import CaseStatusTag from '@/components/library/CaseStatusTag';
import Id from '@/components/ui/Id';
import { addBackUrlToRoute } from '@/utils/backUrl';
import { makeUrl } from '@/utils/routing';

interface Props {
  alertId: string;
  caseUserName: string;
}

export default function InvestigativeCoPilot(props: Props) {
  const { alertId, caseUserName } = props;
  const api = useApi();
  const [history, setHistory] = useState<QuestionResponse[]>([]);

  const rootRef = useRef<HTMLDivElement>(null);

  const historyQuery = useQuery(COPILOT_ALERT_QUESTIONS(alertId), async () => {
    return await api.getQuestions({
      alertId: alertId,
    });
  });

  const historyRes = map(historyQuery.data, ({ data }) => (data ?? []).map(parseQuestionResponse));
  const isHistoryLoaded = useFinishedSuccessfully(historyRes);
  useEffect(() => {
    if (isHistoryLoaded && isSuccess(historyRes)) {
      setHistory(historyRes.value);
    }
  }, [historyRes, isHistoryLoaded]);

  const mutation = useMutation<QuestionResponse, unknown, FormValues>(
    async ({ searchString }) => {
      const response = await api.postQuestion({
        QuestionRequest: {
          questionId: searchString,
          variables: [],
        },
        alertId: alertId,
      });
      return parseQuestionResponse(response);
    },
    {
      onSuccess: (data) => {
        setHistory((prevState) => [...prevState, data]);
      },
      onError: (error) => {
        message.error(getErrorMessage(error));
      },
    },
  );

  useLayoutEffect(() => {
    setTimeout(() => {
      rootRef.current?.scrollTo({ top: rootRef.current?.scrollHeight ?? 0, behavior: 'smooth' });
    }, 0);
  }, [history.length]);

  const alertQueryResult = useQuery(ALERT_ITEM(alertId), async () =>
    api.getAlert({
      alertId,
    }),
  );

  return (
    <AsyncResourceRenderer resource={historyRes}>
      {() => (
        <div className={s.root} ref={rootRef}>
          <div className={s.alertInfo}>
            <AsyncResourceRenderer resource={alertQueryResult.data}>
              {(alert) => (
                <>
                  <Form.Layout.Label title={'User'}>{caseUserName}</Form.Layout.Label>
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
                </>
              )}
            </AsyncResourceRenderer>
          </div>
          <div className={s.history}>
            <History alertId={alertId} items={history} />
          </div>
          <div className={s.form}>
            <RequestForm
              mutation={mutation}
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

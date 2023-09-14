import React, { useLayoutEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import RequestForm, { FormValues } from './RequestForm';
import History from './History';
import { parseQuestionResponse, QuestionResponse } from './types';
import s from './index.module.less';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { ALERT_ITEM } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import * as Form from '@/components/ui/Form';

interface Props {
  alertId: string;
}

export default function InvestigativeCoPilot(props: Props) {
  const { alertId } = props;
  const api = useApi();
  const [history, setHistory] = useState<QuestionResponse[]>([]);

  const rootRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation<QuestionResponse, unknown, FormValues>(
    async ({ searchString }) => {
      await new Promise((resolve) => {
        setTimeout(resolve, Math.round(Math.random() * 2000));
      });
      const response = await api.getQuestion({
        questionId: searchString,
        alertId: alertId,
        variables: [],
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

  const alertQueryResult = useQuery(ALERT_ITEM(alertId), async () => {
    const alert = await api.getAlert({
      alertId,
    });
    return alert;
  });

  return (
    <div className={s.root} ref={rootRef}>
      <div className={s.alertInfo}>
        <AsyncResourceRenderer resource={alertQueryResult.data}>
          {(alert) => (
            <>
              <Form.Layout.Label title={'Alert ID'}>{alert.alertId}</Form.Layout.Label>
              <Form.Layout.Label title={'Case ID'}>{alert.caseId}</Form.Layout.Label>
            </>
          )}
        </AsyncResourceRenderer>
      </div>
      <div className={s.history}>
        <History items={history} />
      </div>
      <div className={s.form}>
        <RequestForm mutation={mutation} />
      </div>
    </div>
  );
}

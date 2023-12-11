import React from 'react';
import { clusteredByDate } from '../helpers';
import { ActivityLogFilterParams } from '..';
import LogContainer from './LogContainer';
import s from './index.module.less';
import { LogItemData } from './LogContainer/LogItem';
import { useQuery } from '@/utils/queries/hooks';
import { AUDIT_LOGS_LIST } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { P } from '@/components/ui/Typography';

interface Props {
  logQueryRequest: (params: ActivityLogFilterParams) => Promise<LogItemData[]>;
  params: ActivityLogFilterParams;
}

const LogCard = (props: Props) => {
  const { logQueryRequest, params } = props;
  const queryResult = useQuery<LogItemData[]>(AUDIT_LOGS_LIST(params), async () => {
    const logItemData = await logQueryRequest(params);
    return logItemData;
  });
  return (
    <AsyncResourceRenderer resource={queryResult.data}>
      {(logItems) => {
        if (logItems.length === 0) {
          return <P>No log entries found</P>;
        }
        const logsMap = clusteredByDate(logItems);
        return (
          <div className={s.root}>
            {Array.from(logsMap).map(([date, logs]) => (
              <LogContainer key={date} date={date} logs={logs} />
            ))}
          </div>
        );
      }}
    </AsyncResourceRenderer>
  );
};

export default LogCard;

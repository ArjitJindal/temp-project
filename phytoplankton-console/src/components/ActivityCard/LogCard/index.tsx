import React from 'react';
import { clusteredByDate } from '../helpers';
import LogContainer from './LogContainer';
import s from './index.module.less';
import { LogItemData } from './LogContainer/LogItem';
import { useAuditLogsList } from '@/hooks/api';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { P } from '@/components/ui/Typography';
import { useUsers } from '@/utils/user-utils';
import Spinner from '@/components/library/Spinner';

interface Props<FilterParams> {
  logQueryRequest: (params: FilterParams) => Promise<LogItemData[]>;
  params: FilterParams;
}

function LogCard<FilterParams>(props: Props<FilterParams>) {
  const { params } = props;
  const [_, isLoading] = useUsers();
  const queryResult = useAuditLogsList({ ...params, isLoading });
  return !isLoading ? (
    <AsyncResourceRenderer resource={queryResult.data}>
      {(logItemsUnknown) => {
        const logItems = logItemsUnknown as unknown as LogItemData[];
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
  ) : (
    <Spinner />
  );
}

export default LogCard;

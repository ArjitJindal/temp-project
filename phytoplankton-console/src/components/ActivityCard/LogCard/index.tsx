import React from 'react';
import { flatten } from 'lodash';
import LogContainer from '../LogContainer';
import { clusteredByDate } from '../helpers';
import { ActivityLogFilterParams } from '..';
import s from './index.module.less';
import { useQuery } from '@/utils/queries/hooks';
import { AuditLogListResponse } from '@/apis';
import { useApi } from '@/api';
import { AUDIT_LOGS_LIST } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';

interface Props {
  entityIds: string[];
  params: ActivityLogFilterParams;
  type: 'USER' | 'CASE';
}

const LogCard = (props: Props) => {
  const { entityIds, params, type } = props;
  const api = useApi();
  const { data: resource } = useQuery<AuditLogListResponse>(AUDIT_LOGS_LIST(params), async () => {
    const { alertId, filterCaseStatus, filterAlertStatus, filterActivityBy } = params;
    const response = await api.getAuditlog({
      sortField: 'timestamp',
      sortOrder: 'descend',
      searchEntityId: alertId ? [alertId] : entityIds,
      filterActions: ['CREATE', 'UPDATE'],
      filterActionTakenBy: filterActivityBy,
      alertStatus: flatten(filterAlertStatus),
      caseStatus: flatten(filterCaseStatus),
      includeRootUserRecords: true,
      pageSize: 100,
    });
    return response;
  });
  return (
    <AsyncResourceRenderer resource={resource}>
      {(resourceData) => {
        const logsMap = clusteredByDate(resourceData.data);
        return (
          <div className={s.root}>
            {Array.from(logsMap).map(([date, logs]) => (
              <LogContainer date={date} logs={logs} type={type} />
            ))}
          </div>
        );
      }}
    </AsyncResourceRenderer>
  );
};

export default LogCard;

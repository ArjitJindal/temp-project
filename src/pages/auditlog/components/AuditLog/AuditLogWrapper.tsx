import React, { useState } from 'react';
import moment from 'moment';
import { TableSearchParams } from './types';
import AuditLogs from './AuditLog';
import { AuditLog, AuditLogListResponse } from '@/apis';
import { useApi } from '@/api';
import { useAnalytics } from '@/utils/segment/context';
import { measure } from '@/utils/time-utils';
import { parseQueryString } from '@/utils/routing';
import { useDeepEqualEffect } from '@/utils/hooks';
import { queryAdapter } from '@/pages/case-management/helpers';
import { useQuery } from '@/utils/queries/hooks';
import { AllParams, DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/consts';
import { AUDIT_LOGS_LIST } from '@/utils/queries/keys';

export type AuditLogItem = AuditLog & {
  index: number;
  rowKey: string;
};

export default function AuditLogWrapper() {
  const api = useApi();
  const analytics = useAnalytics();

  const parsedParams = queryAdapter.deserializer(parseQueryString(location.search));

  const [params, setParams] = useState<AllParams<TableSearchParams>>({
    ...DEFAULT_PARAMS_STATE,
    ...parsedParams,
  });

  useDeepEqualEffect(() => {
    setParams((prevState: AllParams<TableSearchParams>) => ({
      ...prevState,
      ...parsedParams,
      page: parsedParams.page ?? 1,
      sort: parsedParams.sort ?? [],
    }));
  }, [parsedParams]);

  const queryResults = useQuery<AuditLogListResponse>(AUDIT_LOGS_LIST({ ...params }), async () => {
    const { sort, page, timestamp, filterTypes } = params;
    const [sortField, sortOrder] = sort[0] ?? [];
    const [response, time] = await measure(() =>
      api.getAuditlog({
        limit: DEFAULT_PAGE_SIZE!,
        skip: (page! - 1) * DEFAULT_PAGE_SIZE!,
        afterTimestamp: timestamp ? moment(timestamp[0]).valueOf() : 0,
        beforeTimestamp: Number.MAX_SAFE_INTEGER,
        filterTypes: filterTypes,
        sortField: sortField ?? undefined,
        sortOrder: sortOrder ?? undefined,
      }),
    );
    analytics.event({
      title: 'Table Loaded',
      time,
    });
    return response;
  });

  return <AuditLogs params={params} queryResult={queryResults} />;
}

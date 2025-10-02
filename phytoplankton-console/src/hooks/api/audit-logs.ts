import { useApi } from '@/api';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { AUDIT_LOGS_LIST } from '@/utils/queries/keys';
import type { AuditLog } from '@/apis';

export function useAuditLogsList(params: any) {
  const api = useApi();
  return usePaginatedQuery<AuditLog>(AUDIT_LOGS_LIST(params), async (paginationParams) => {
    const {
      sort,
      page,
      pageSize,
      filterTypes,
      createdTimestamp,
      filterActionTakenBy,
      filterActions,
      searchEntityId,
      includeRootUserRecords,
    } = params;
    const [sortField, sortOrder] = sort[0] ?? [];
    const [start, end] = createdTimestamp ?? [];

    const response = await api.getAuditlog({
      page,
      pageSize,
      ...paginationParams,
      afterTimestamp: start ? start.startOf('day').valueOf() : 0,
      beforeTimestamp: end ? end.endOf('day').valueOf() : Number.MAX_SAFE_INTEGER,
      sortField: sortField ?? undefined,
      sortOrder: sortOrder ?? undefined,
      filterTypes,
      filterActionTakenBy,
      includeRootUserRecords,
      searchEntityId: searchEntityId ? [searchEntityId] : [],
      filterActions,
    });

    return {
      total: response.total,
      items: response.data,
    };
  });
}

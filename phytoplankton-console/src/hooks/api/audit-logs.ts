import { useQuery } from '@/utils/queries/hooks';
import { AUDIT_LOGS_LIST } from '@/utils/queries/keys';

export function useAuditLogsList<FilterParams, TItem>(
  params: FilterParams,
  request: (params: FilterParams) => Promise<TItem[]>,
  options?: { enabled?: boolean },
) {
  return useQuery<TItem[]>(
    AUDIT_LOGS_LIST(params as unknown as any),
    () => request(params),
    options,
  );
}

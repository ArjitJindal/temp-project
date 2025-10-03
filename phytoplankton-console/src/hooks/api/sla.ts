import { useApi } from '@/api';
import { useMutation } from '@/utils/queries/mutations/hooks';
import type { SLAPolicy } from '@/apis';

export function useCreateSlaPolicy() {
  const api = useApi();
  return useMutation((payload: { policy: SLAPolicy }) =>
    api.postSlaPolicy({ SLAPolicy: payload.policy }),
  );
}

export function useUpdateSlaPolicy() {
  const api = useApi();
  return useMutation((payload: { slaId: string; policy: SLAPolicy }) =>
    api.putSlaPolicy({ slaId: payload.slaId, SLAPolicy: payload.policy }),
  );
}

export function useDeleteSlaPolicy() {
  const api = useApi();
  return useMutation((slaId: string) => api.deleteSlaPolicy({ slaId }));
}

import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import type { QueryResult } from '@/utils/queries/types';
import type { PaginatedData } from '@/utils/queries/hooks';
import { SLA_POLICY, SLA_POLICY_LIST } from '@/utils/queries/keys';

export function useSlaPolicies(params?: any): QueryResult<any> {
  const api = useApi();
  return useQuery(SLA_POLICY_LIST(params), async () => {
    return await api.getSlaPolicies(params ?? {});
  });
}

export function useSlaPoliciesPaginated(
  params: any,
  pageParams: any,
): QueryResult<PaginatedData<any>> {
  const api = useApi();
  return usePaginatedQuery(SLA_POLICY_LIST(params), async (_) => {
    return await api.getSlaPolicies({ ...params, ...pageParams });
  });
}

export function useSlaPolicy(slaId: string): QueryResult<any> {
  const api = useApi();
  return useQuery(SLA_POLICY(slaId), async () => api.getSlaPolicy({ slaId }));
}

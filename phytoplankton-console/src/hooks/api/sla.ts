import { useApi } from '@/api';
import { useMutation } from '@/utils/queries/mutations/hooks';
import type { SLAPolicy, SLAPoliciesResponse, SLAPolicyIdResponse } from '@/apis';

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
import { SLA_POLICY, SLA_POLICY_ID, SLA_POLICY_LIST } from '@/utils/queries/keys';
import { AsyncResource, map } from '@/utils/asyncResource';

export function useSlaPolicies(params?: any): QueryResult<any> {
  const api = useApi();
  return useQuery(SLA_POLICY_LIST(params), async () => {
    return await api.getSlaPolicies(params ?? {});
  });
}

export function useSlas(): AsyncResource<SLAPolicy[]> {
  const api = useApi();
  const result = useQuery<SLAPoliciesResponse>(SLA_POLICY_LIST(), async () => api.getSlaPolicies());
  return map(result.data, ({ items }) => items);
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

export function useNewSlaId(options?: { enabled?: boolean }): QueryResult<SLAPolicyIdResponse> {
  const api = useApi();
  return useQuery<SLAPolicyIdResponse>(
    SLA_POLICY_ID('new'),
    async () => {
      return await api.getNewSlaId();
    },
    {
      enabled: options?.enabled ?? true,
      staleTime: 0,
      cacheTime: 0,
    },
  );
}

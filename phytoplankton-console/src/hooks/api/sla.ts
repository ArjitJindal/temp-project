import { useApi } from '@/api';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import { SLA_POLICY, SLA_POLICY_LIST } from '@/utils/queries/keys';

export function useSlaPolicies(params?: any) {
  const api = useApi();
  return useQuery(SLA_POLICY_LIST(params), async () => {
    return await api.getSlaPolicies(params ?? {});
  });
}

export function useSlaPoliciesPaginated(params: any, pageParams: any) {
  const api = useApi();
  return usePaginatedQuery(SLA_POLICY_LIST(params), async (_) => {
    return await api.getSlaPolicies({ ...params, ...pageParams });
  });
}

export function useSlaPolicy(slaId: string) {
  const api = useApi();
  return useQuery(SLA_POLICY(slaId), async () => api.getSlaPolicy({ slaId }));
}

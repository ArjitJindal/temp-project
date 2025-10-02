import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { SECONDARY_QUEUE_TENANTS } from '@/utils/queries/keys';

export function useTenantsList(options?: { enabled?: boolean }) {
  const api = useApi();
  return useQuery(['tenants'], () => api.getTenantsList(), { enabled: options?.enabled });
}

export function useSecondaryQueueTenants() {
  const api = useApi();
  return useQuery(SECONDARY_QUEUE_TENANTS(), async () => {
    const tenants = await api.getTenantsSecondaryQueueTenants();
    return tenants;
  });
}

export function useTenantsDeletionData() {
  const api = useApi();
  return useQuery(['tenantsFailedToDelete'], async () => {
    return await api.getTenantsDeletionData();
  });
}

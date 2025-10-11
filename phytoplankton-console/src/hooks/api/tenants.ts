import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { SECONDARY_QUEUE_TENANTS, TENANT } from '@/utils/queries/keys';
import type { QueryResult } from '@/utils/queries/types';
import type { Tenant } from '@/apis';

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

export function useTenant(): QueryResult<Tenant | null> {
  const api = useApi();
  return useQuery(TENANT('current'), async () => {
    try {
      return await api.getTenant();
    } catch (e) {
      console.error(e);
      return null;
    }
  });
}

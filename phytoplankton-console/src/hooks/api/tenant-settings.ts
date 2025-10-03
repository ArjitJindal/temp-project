import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import type { QueryResult } from '@/utils/queries/types';
import { PERMISSIONS_STATEMENTS, SETTINGS } from '@/utils/queries/keys';
import { TenantSettings } from '@/apis';

export function useTenantApiKeys(unmaskedApiKey?: string): QueryResult<any> {
  const api = useApi();
  return useQuery(['apiKeys', { unmaskedApiKey }], async () => {
    return await api.getTenantApiKeys(
      unmaskedApiKey ? { unmask: true, unmaskApiKeyId: unmaskedApiKey } : {},
    );
  });
}

export function usePermissionsStatements(): QueryResult<any> {
  const api = useApi();
  return useQuery(PERMISSIONS_STATEMENTS(), () => api.getRolesByNameStatements());
}

export function useTenantSettings(): QueryResult<TenantSettings> {
  const api = useApi();
  return useQuery<TenantSettings>(SETTINGS(), async () => {
    return await api.getTenantsSettings();
  });
}

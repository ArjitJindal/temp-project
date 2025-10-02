import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { PERMISSIONS_STATEMENTS, SETTINGS } from '@/utils/queries/keys';
import { TenantSettings } from '@/apis';

export function useTenantApiKeys(unmaskedApiKey?: string) {
  const api = useApi();
  return useQuery(['apiKeys', { unmaskedApiKey }], async () => {
    return await api.getTenantApiKeys(
      unmaskedApiKey ? { unmask: true, unmaskApiKeyId: unmaskedApiKey } : {},
    );
  });
}

export function usePermissionsStatements() {
  const api = useApi();
  return useQuery(PERMISSIONS_STATEMENTS(), () => api.getRolesByNameStatements());
}

export function useTenantSettings() {
  const api = useApi();
  return useQuery<TenantSettings>(SETTINGS(), async () => {
    return await api.getTenantsSettings();
  });
}

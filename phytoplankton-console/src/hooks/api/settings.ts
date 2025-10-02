import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';

export function useTenantApiKeys(unmaskedApiKey?: string) {
  const api = useApi();
  return useQuery(['apiKeys', { unmaskedApiKey }], async () => {
    return await api.getTenantApiKeys(
      unmaskedApiKey ? { unmask: true, unmaskApiKeyId: unmaskedApiKey } : {},
    );
  });
}

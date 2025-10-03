import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { ACTION_REASONS } from '@/utils/queries/keys';
import type { ConsoleActionReasonCreationRequest, ReasonType } from '@/apis';

export function useActionReasons() {
  const api = useApi();
  return useQuery(ACTION_REASONS(), async () => api.getActionReasons({}));
}

export function useToggleActionReason(options?: any) {
  const api = useApi();
  return useMutation(
    (values: { reasonId: string; isActive: boolean; reasonType: ReasonType }) =>
      api.toggleActionReason({
        reasonId: values.reasonId,
        ConsoleActionReasonPutRequest: {
          isActive: values.isActive,
          reasonType: values.reasonType,
        },
      }),
    options,
  );
}

export function useCreateActionReasons(options?: any) {
  const api = useApi();
  return useMutation(
    (data: ConsoleActionReasonCreationRequest[]) =>
      api.createActionReasons({ ConsoleActionReasonCreationRequest: data }),
    options,
  );
}

export function useTenantApiKeys(unmaskedApiKey?: string) {
  const api = useApi();
  return useQuery(['apiKeys', { unmaskedApiKey }], async () => {
    return await api.getTenantApiKeys(
      unmaskedApiKey ? { unmask: true, unmaskApiKeyId: unmaskedApiKey } : {},
    );
  });
}

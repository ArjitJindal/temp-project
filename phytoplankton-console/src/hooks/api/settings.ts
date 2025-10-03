import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { ACTION_REASONS, NANGO_CONNECTIONS } from '@/utils/queries/keys';
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

// Consolidated in hooks/api/tenant-settings.ts

export function useNangoConnections() {
  const api = useApi();
  return useQuery(NANGO_CONNECTIONS(), () => api.getTenantsNangoConnections());
}

export function useDeleteNangoConnection() {
  const api = useApi();
  return useMutation((vars: { providerConfigKey: string; connectionId: string }) =>
    api.deleteTenantsNangoConnections({
      NangoPostConnect: {
        providerConfigKey: vars.providerConfigKey,
        connectionId: vars.connectionId,
      },
    }),
  );
}

export function useCreateNangoConnection() {
  const api = useApi();
  return useMutation((vars: { providerConfigKey: string; connectionId: string }) =>
    api.postTenantsNangoConnections({
      NangoPostConnect: {
        connectionId: vars.connectionId,
        providerConfigKey: vars.providerConfigKey,
      },
    }),
  );
}

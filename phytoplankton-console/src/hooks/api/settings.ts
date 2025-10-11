import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { useMutation } from '@/utils/queries/mutations/hooks';
import {
  ACTION_REASONS,
  COPILOT_AI_RESOURCES,
  NANGO_CONNECTIONS,
  TENANT_USAGE_DATA,
  TENANT_SETTINGS_UNMASK,
} from '@/utils/queries/keys';
import type { AiSourcesResponse, ConsoleActionReasonCreationRequest, ReasonType } from '@/apis';
import { getOr } from '@/utils/asyncResource';

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

export function useCopilotAiSources() {
  const api = useApi();
  return useQuery<AiSourcesResponse>(COPILOT_AI_RESOURCES(), async () => api.getAiSources());
}

export function useTenantUsageData() {
  const api = useApi();
  return useQuery(TENANT_USAGE_DATA(), async () => api.getTenantUsageData());
}

export function useActionReasons(type?: ReasonType) {
  const api = useApi();
  return useQuery(ACTION_REASONS(type), async () => api.getActionReasons({ type }));
}

export function useReasons(type?: ReasonType, filterInactive: boolean = true): string[] {
  const reasonsRes = useActionReasons(type);
  const actionReasons = getOr(reasonsRes.data, [] as { isActive: boolean; reason: string }[]);
  return actionReasons.filter((val) => (filterInactive ? val.isActive : true)).map((d) => d.reason);
}

export function useTenantSettingsUnmask(unmaskDowJonesPassword: boolean) {
  const api = useApi();
  return useQuery(
    TENANT_SETTINGS_UNMASK(unmaskDowJonesPassword),
    async () => await api.getTenantsSettings({ unmaskDowJonesPassword }),
    {
      enabled: unmaskDowJonesPassword,
      retry: false,
    },
  );
}

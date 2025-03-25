import React, { useContext, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { isEmpty, toLower } from 'lodash';
import { capitalizeWords, humanizeConstant } from '@flagright/lib/utils/humanize';
import { useAuth0 } from '@auth0/auth0-react';
import { useApi } from '@/api';
import {
  ApiException,
  Feature as FeatureName,
  ManagedRoleName,
  RiskLevel,
  RuleAction,
  TenantSettings,
  TransactionState,
} from '@/apis';
import { useQuery } from '@/utils/queries/hooks';
import { SETTINGS } from '@/utils/queries/keys';
import { usePrevious } from '@/utils/hooks';
import { isFailed, isSuccess } from '@/utils/asyncResource';
import { message } from '@/components/library/Message';
import ErrorPage from '@/components/ErrorPage';
import { useAccountRole, UserRole } from '@/utils/user-utils';
import { PageLoading } from '@/components/PageLoading';
import { SuspendedAccount } from '@/components/SuspendedAccount';
import Alert from '@/components/library/Alert';

interface ContextValue {
  features: FeatureName[];
  settings: TenantSettings;
  reloadSettings: () => void;
}

export const Context = React.createContext<ContextValue | null>(null);

export default function SettingsProvider(props: { children: React.ReactNode }) {
  const globalFeatures = FEATURES_ENABLED as FeatureName[];
  const api = useApi();
  const role = useAccountRole();
  const { logout } = useAuth0();

  const queryResults = useQuery(SETTINGS(), async (): Promise<TenantSettings> => {
    try {
      return await api.getTenantsSettings();
    } catch (e) {
      if ((e as ApiException<unknown>).httpMessage === 'Unauthorized') {
        logout({
          returnTo: window.location.origin,
        });
      }
      throw e;
    }
  });

  const previousQueryResults = usePrevious(queryResults);

  const settings = useMemo(() => {
    return isSuccess(queryResults.data) || !previousQueryResults
      ? isSuccess(queryResults.data)
        ? queryResults.data.value
        : {}
      : isSuccess(previousQueryResults.data)
      ? previousQueryResults.data.value
      : {};
  }, [queryResults.data, previousQueryResults]);

  const features = useMemo(() => {
    return !isEmpty(settings) ? (settings.features || []).concat(globalFeatures ?? []) : null;
  }, [settings, globalFeatures]);

  const reloadSettings = () => {
    queryResults.refetch();
  };

  if (isFailed(queryResults.data)) {
    return (
      <ErrorPage title={'Unable to load user settings'}>{queryResults.data.message}</ErrorPage>
    );
  }
  if (features == null) {
    return <PageLoading />;
  }

  if (role !== UserRole.ROOT && settings.isAccountSuspended) {
    return <SuspendedAccount />;
  }

  return (
    <Context.Provider value={{ features, settings, reloadSettings }}>
      {props.children}
    </Context.Provider>
  );
}

function useSettingsContext() {
  const context = useContext(Context);
  if (context == null) {
    throw new Error(`Features context is not initialized`);
  }
  return context;
}

export function useSettings(): TenantSettings {
  const context = useSettingsContext();
  return { ...context.settings, userAlias: context.settings.userAlias || 'user' };
}

export function useReloadSettings() {
  const context = useSettingsContext();
  return context.reloadSettings;
}

export function useFeatures(): FeatureName[] {
  const context = useSettingsContext();
  return context.features;
}

export function useFeatureEnabled(feature: FeatureName): boolean {
  const features = useFeatures();
  return features.includes(feature) || false;
}

export function useHasNoSanctionsProviders(): boolean {
  const features = useFeatures();
  return (
    !features.includes('ACURIS') &&
    !features.includes('OPEN_SANCTIONS') &&
    !features.includes('DOW_JONES')
  );
}

export function useFeaturesEnabled(features: FeatureName[]): boolean {
  const enabledFeatures = useFeatures();
  return features.every((feature) => enabledFeatures.includes(feature));
}

export function useFreshdeskCrmEnabled(): boolean {
  const settings = useSettings();
  const crmFeatureEnabled = useFeatureEnabled('CRM');
  return settings.crmIntegrationName === 'FRESHDESK' && crmFeatureEnabled;
}

export function Feature(props: {
  name: FeatureName | FeatureName[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showError?: boolean;
}) {
  const features = Array.isArray(props.name) ? props.name : [props.name];
  const isEnabled = useFeaturesEnabled(features);
  if (!isEnabled) {
    if (props.fallback) {
      return <>{props.fallback}</>;
    }
    if (props.showError) {
      return <Alert type={'ERROR'}>{`Missing required features: ${features.join(', ')}`}</Alert>;
    }
    return <></>;
  }
  return <>{props.children}</>;
}

export function FeatureEnabled(props: {
  name: FeatureName;
  children: (isEnabled: boolean) => React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const isEnabled = useFeatureEnabled(props.name);
  return <>{props.children(isEnabled)}</>;
}

export function Roles(props: {
  roles: ManagedRoleName[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const role = useAccountRole();
  return props.roles.includes(role) ? <>{props.children}</> : <>{props.fallback}</>;
}

export function getRuleActionLabel(
  ruleAction: RuleAction | undefined,
  settings: TenantSettings,
): string | undefined {
  if (!ruleAction) {
    return;
  }
  const alias = settings.ruleActionAliases?.find((item) => item.action === ruleAction)?.alias;
  return alias || humanizeConstant(ruleAction);
}

export function useRuleActionLabel(ruleAction: RuleAction | undefined): string | undefined {
  const settings = useSettings();
  return getRuleActionLabel(ruleAction, settings);
}

export function getRiskLevelLabel(riskLevel: RiskLevel, settings: TenantSettings): string {
  const alias = settings.riskLevelAlias?.find((item) => item.level === riskLevel)?.alias;
  return alias || humanizeConstant(riskLevel);
}

export function getRiskLevelFromAlias(riskLevelAlias: string, settings: TenantSettings): string {
  const riskLevel =
    settings.riskLevelAlias?.find(
      (item) => toLower(item.alias).replace('_', ' ') === toLower(riskLevelAlias).replace('_', ' '),
    )?.level || riskLevelAlias;
  return riskLevel;
}

export function useRiskLevelLabel(riskLevel: RiskLevel): string | undefined {
  const settings = useSettings();
  return getRiskLevelLabel(riskLevel, settings);
}

export function getTransactionStateLabel(
  transactionState: TransactionState | undefined,
  settings: TenantSettings,
): string | undefined {
  if (!transactionState) {
    return;
  }
  const alias = settings.transactionStateAlias?.find(
    (item) => item.state === transactionState,
  )?.alias;
  return alias || capitalizeWords(transactionState);
}

export function useTransactionStateLabel(
  transactionState: TransactionState | undefined,
): string | undefined {
  const settings = useSettings();
  return getTransactionStateLabel(transactionState, settings);
}

export function useUpdateTenantSettings() {
  const api = useApi();
  const reloadSettings = useReloadSettings();
  return useMutation<unknown, unknown, TenantSettings>(
    async (partialTenantSettings) => {
      await api.postTenantsSettings({
        TenantSettings: partialTenantSettings,
      });
    },
    {
      retry: false,
      onSuccess: () => {
        message.success('Settings saved');
        reloadSettings();
      },
      onError: (e) => {
        message.fatal('Failed to save settings', e);
      },
    },
  );
}

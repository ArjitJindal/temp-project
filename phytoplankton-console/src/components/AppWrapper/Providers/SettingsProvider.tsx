import React, { useContext, useMemo } from 'react';
import { PageLoading } from '@ant-design/pro-layout';
import _ from 'lodash';
import { useMutation } from '@tanstack/react-query';
import { useApi } from '@/api';
import {
  Feature as FeatureName,
  RuleAction,
  TenantSettings,
  TransactionState,
  RiskLevel,
  ManagedRoleName,
} from '@/apis';
import { capitalizeWords } from '@/utils/tags';
import { useQuery } from '@/utils/queries/hooks';
import { SETTINGS } from '@/utils/queries/keys';
import { usePrevious } from '@/utils/hooks';
import { isFailed, isSuccess } from '@/utils/asyncResource';
import { message } from '@/components/library/Message';
import { humanizeConstant } from '@/utils/humanize';
import ErrorPage from '@/components/ErrorPage';
import { useAccountRole } from '@/utils/user-utils';

interface ContextValue {
  features: FeatureName[];
  settings: TenantSettings;
  reloadSettings: () => void;
}

export const Context = React.createContext<ContextValue | null>(null);

export default function SettingsProvider(props: {
  globalFeatures?: FeatureName[];
  children: React.ReactNode;
}) {
  const globalFeatures = props.globalFeatures;
  const api = useApi();

  const queryResults = useQuery(
    SETTINGS(),
    (): Promise<TenantSettings> => api.getTenantsSettings(),
  );

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
    return !_.isEmpty(settings) ? (settings.features || []).concat(globalFeatures ?? []) : null;
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
  return context.settings;
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

export function useFeaturesEnabled(features: FeatureName[]): boolean {
  const enabledFeatures = useFeatures();
  return features.every((feature) => enabledFeatures.includes(feature));
}

export function Feature(props: {
  name: FeatureName;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const isEnabled = useFeatureEnabled(props.name);
  return isEnabled ? <>{props.children}</> : <>{props.fallback}</>;
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
      (item) =>
        _.toLower(item.alias).replace('_', ' ') === _.toLower(riskLevelAlias).replace('_', ' '),
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

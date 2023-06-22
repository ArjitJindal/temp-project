import React, { useContext, useEffect, useState } from 'react';
import { PageLoading } from '@ant-design/pro-layout';
import _ from 'lodash';
import { useApi } from '@/api';
import {
  Feature as FeatureName,
  RuleAction,
  TenantSettings,
  TransactionState,
  RiskLevel,
} from '@/apis';
import { capitalizeWords } from '@/utils/tags';
import { useApiTime } from '@/utils/tracker';

interface ContextValue {
  features: FeatureName[];
  settings: TenantSettings;
}

export const Context = React.createContext<ContextValue | null>(null);

export default function SettingsProvider(props: {
  globalFeatures?: FeatureName[];
  children: React.ReactNode;
}) {
  const globalFeatures = props.globalFeatures;
  const api = useApi();
  const measure = useApiTime();
  const [settings, setSettings] = useState<TenantSettings>({});
  const [features, setFeatures] = useState<FeatureName[] | null>(null);
  useEffect(() => {
    if (!_.isEmpty(settings)) {
      return;
    }

    async function fetch() {
      const settings = await measure(() => api.getTenantsSettings(), 'Tenant Settings');
      setSettings(settings);
      setFeatures((settings.features || []).concat(globalFeatures ?? []));
    }
    fetch().catch((e) => {
      setFeatures(globalFeatures ?? []);
      console.error(e);
    });
  }, [api, globalFeatures, measure, settings]);
  if (features == null) {
    return <PageLoading />;
  }
  return <Context.Provider value={{ features, settings }}>{props.children}</Context.Provider>;
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

export function getRiskActionLabel(
  ruleAction: RuleAction | undefined,
  settings: TenantSettings,
): string | undefined {
  if (!ruleAction) {
    return;
  }
  const alias = settings.ruleActionAliases?.find((item) => item.action === ruleAction)?.alias;
  return alias || capitalizeWords(ruleAction);
}

export function useRiskActionLabel(ruleAction: RuleAction | undefined): string | undefined {
  const settings = useSettings();
  return getRiskActionLabel(ruleAction, settings);
}
export function getRiskLevelLabel(riskLevel: RiskLevel, settings: TenantSettings): string {
  const alias = settings.riskLevelAlias?.find((item) => item.level === riskLevel)?.alias;
  return alias || capitalizeWords(riskLevel);
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

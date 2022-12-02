import React, { useContext, useEffect, useState } from 'react';
import { PageLoading } from '@ant-design/pro-layout';
import _ from 'lodash';
import { useApi } from '@/api';
import { Feature as FeatureName, RuleAction, TenantSettings, TransactionState } from '@/apis';

interface ContextValue {
  features: FeatureName[];
  settings: TenantSettings;
}

const Context = React.createContext<ContextValue | null>(null);

export function SettingsProvider(props: {
  globalFeatures?: FeatureName[];
  children: React.ReactNode;
}) {
  const globalFeatures = props.globalFeatures;
  const api = useApi();
  const [settings, setSettings] = useState<TenantSettings>({});
  const [features, setFeatures] = useState<FeatureName[] | null>(null);
  useEffect(() => {
    async function fetch() {
      const settings = await api.getTenantsSettings();
      setSettings(settings);
      setFeatures((settings.features || []).concat(globalFeatures ?? []));
    }
    fetch().catch((e) => {
      setFeatures(globalFeatures ?? []);
      console.error(e);
    });
  }, [api, globalFeatures]);
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

export function useFeature(feature: FeatureName): boolean {
  const features = useFeatures();
  return features.includes(feature) || false;
}

export function Feature(props: {
  name: FeatureName;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const isEnabled = useFeature(props.name);
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
  return alias || _.capitalize(ruleAction);
}

export function useRiskActionLabel(ruleAction: RuleAction | undefined): string | undefined {
  const settings = useSettings();
  return getRiskActionLabel(ruleAction, settings);
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
  return alias || _.capitalize(transactionState);
}

export function useTransactionStateLabel(
  transactionState: TransactionState | undefined,
): string | undefined {
  const settings = useSettings();
  return getTransactionStateLabel(transactionState, settings);
}

import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth0 } from '@auth0/auth0-react';
import { isEmpty, toLower } from 'lodash';
import { capitalizeWords, humanizeAuto, humanizeConstant } from '@flagright/lib/utils/humanize';
import { COUNTRIES } from '@flagright/lib/constants';
import {
  PermissionStatements,
  Feature as FeatureName,
  TenantSettings,
  ApiException,
  ManagedRoleName,
  RuleAction,
  RiskLevel,
  TransactionState,
  CountryCode,
} from '@/apis';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { PageLoading } from '@/components/PageLoading';
import { PERMISSIONS_STATEMENTS, SETTINGS } from '@/utils/queries/keys';
import { useAccountRole, UserRole } from '@/utils/user-utils';
import { usePrevious } from '@/utils/hooks';
import { all, isFailed, isSuccess } from '@/utils/asyncResource';
import { message } from '@/components/library/Message';
import ErrorPage from '@/components/ErrorPage';
import { SuspendedAccount } from '@/components/SuspendedAccount';
import Alert from '@/components/library/Alert';
import { TransactionChartSeries } from '@/pages/dashboard/analysis/components/TransactionsChartWidget';

interface StatementsContextValue {
  statements: PermissionStatements[];
}

interface SettingsContextValue {
  settings: TenantSettings;
  features: FeatureName[] | null;
  reloadSettings: () => void;
}

export const StatementsContext = createContext<StatementsContextValue | undefined>(undefined);
export const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export const useResources = () => {
  const context = useContext(StatementsContext);
  if (!context) {
    throw new Error('useResources must be used within a StatementsProvider');
  }
  return context;
};

export const StatementsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}): JSX.Element => {
  const globalFeatures = FEATURES_ENABLED as FeatureName[];
  const api = useApi();
  const role = useAccountRole();
  const { logout } = useAuth0();

  const queryResult = useQuery(PERMISSIONS_STATEMENTS(), () => api.getRolesByNameStatements());

  const settingsResults = useQuery(SETTINGS(), async (): Promise<TenantSettings> => {
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

  const previousSettingsResults = usePrevious(settingsResults);

  const settings = useMemo(() => {
    return isSuccess(settingsResults.data) || !previousSettingsResults
      ? isSuccess(settingsResults.data)
        ? settingsResults.data.value
        : {}
      : isSuccess(previousSettingsResults.data)
      ? previousSettingsResults.data.value
      : {};
  }, [settingsResults.data, previousSettingsResults]);

  const features = useMemo(() => {
    return !isEmpty(settings) ? (settings.features || []).concat(globalFeatures ?? []) : null;
  }, [settings, globalFeatures]);

  const reloadSettings = () => {
    settingsResults.refetch();
  };

  if (isFailed(settingsResults.data)) {
    return (
      <ErrorPage title={'Unable to load user settings'}>{settingsResults.data.message}</ErrorPage>
    );
  }

  if (role !== UserRole.ROOT && settings.isAccountSuspended) {
    return <SuspendedAccount />;
  }

  return (
    <AsyncResourceRenderer
      resource={all([queryResult.data, settingsResults.data])}
      renderLoading={() => {
        return <PageLoading />;
      }}
    >
      {([statements, settings]) => (
        <StatementsContext.Provider value={{ statements }}>
          <SettingsContext.Provider value={{ settings, features, reloadSettings }}>
            {children}
          </SettingsContext.Provider>
        </StatementsContext.Provider>
      )}
    </AsyncResourceRenderer>
  );
};

export default StatementsProvider;

export function useSettingsContext() {
  const context = useContext(SettingsContext);
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
  return context.features || [];
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
  ruleAction: RuleAction | TransactionChartSeries | undefined,
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

export function getRiskLevelLabel(
  riskLevel: RiskLevel,
  settings: TenantSettings,
): { riskLevelLabel: string; isActive: boolean } {
  const riskLevelData = settings.riskLevelAlias?.find((item) => item.level === riskLevel);

  const alias = riskLevelData?.alias?.trim();
  const isActive = riskLevelData?.isActive ?? true;
  const riskLevelLabel = alias && alias.length > 0 ? alias : humanizeConstant(riskLevel);

  return { riskLevelLabel, isActive };
}

export function getFirstActiveRiskLevel(settings: TenantSettings): RiskLevel {
  const firstActive = settings.riskLevelAlias?.find((item) => item.isActive);
  return firstActive ? firstActive.level : 'VERY_LOW';
}
export function getLastActiveRiskLevel(settings: TenantSettings): RiskLevel {
  const lastActive = settings.riskLevelAlias
    ? [...settings.riskLevelAlias].reverse().find((item) => item.isActive)
    : undefined;
  return lastActive?.level || 'VERY_HIGH';
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
  return getRiskLevelLabel(riskLevel, settings).riskLevelLabel;
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

export function useUpdateTenantSettings(successMessage?: string) {
  const api = useApi();
  // const reloadSettings = useReloadSettings();
  return useMutation<unknown, unknown, TenantSettings>(
    async (partialTenantSettings) => {
      await api.postTenantsSettings({
        TenantSettings: partialTenantSettings,
      });
    },
    {
      retry: false,
      onSuccess: () => {
        message.success(successMessage || 'Settings saved successfully');
        // reloadSettings();
      },
      onError: (e) => {
        message.fatal('Failed to save settings', e);
      },
    },
  );
}

export function useReloadTenantSettings(successMessage?: string) {
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
        message.success(successMessage || 'Settings updated successfully');
        reloadSettings();
      },
      onError: (e) => {
        message.fatal('Failed to save settings', e);
      },
    },
  );
}

export function useGetAlias() {
  const { transactionStateAlias, riskLevelAlias, kycStatusAlias, userStateAlias } = useSettings();
  return useCallback(
    (x: string, humanize: boolean = false) => {
      const countryAlias = COUNTRIES[x.toUpperCase() as CountryCode];
      const alias =
        kycStatusAlias?.find((item) => item.state === x)?.alias ||
        userStateAlias?.find((item) => item.state === x)?.alias ||
        transactionStateAlias?.find((item) => item.state === x)?.alias ||
        riskLevelAlias?.find((item) => item.level === x)?.alias ||
        (countryAlias
          ? `${COUNTRIES[x.toUpperCase() as CountryCode]} (${x.toUpperCase()})`
          : undefined) ||
        x;
      return humanize ? humanizeAuto(alias) : alias;
    },
    [transactionStateAlias, riskLevelAlias, kycStatusAlias, userStateAlias],
  );
}

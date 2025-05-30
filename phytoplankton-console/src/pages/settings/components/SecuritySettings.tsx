import { Fragment, useCallback } from 'react';
import SettingsCard from '@/components/library/SettingsCard';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Toggle from '@/components/library/Toggle';
import { MAX_LOGIN_ATTEMPTS_BEFORE_BLOCKING, useHasPermissions } from '@/utils/user-utils';
import Select from '@/components/library/Select';

type SelectOption = {
  value: number;
  label: string;
};

const maxActiveSessionsOptions: SelectOption[] = [
  { value: 0, label: 'No limit' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
];
const passwordResetDaysOptions: SelectOption[] = [
  { value: 0, label: 'No limit' },
  { value: 1, label: '1 day' },
  { value: 30, label: '30 days' },
  { value: 45, label: '45 days' },
  { value: 60, label: '2 months' },
  { value: 90, label: '3 months' },
  { value: 180, label: '6 months' },
  { value: 365, label: '1 year' },
];
const accountDormancyAllowedDaysOptions: SelectOption[] = [
  { value: 0, label: 'No limit' },
  { value: 1, label: '1 day' },
  { value: 45, label: '45 days' },
  { value: 60, label: '2 months' },
  { value: 90, label: '3 months' },
  { value: 180, label: '6 months' },
  { value: 365, label: '1 year' },
];

const sessionTimeoutOptions: SelectOption[] = [
  { value: 0, label: 'Default' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 1440, label: '24 hours' },
  { value: 2880, label: '48 hours' },
];

type SecuritySetting =
  | 'mfa'
  | 'password-expiration'
  | 'account-dormancy'
  | 'session-timeout'
  | 'concurrent-sessions'
  | 'brute-force';

const useSecuritySettings = (setting: SecuritySetting) => {
  const isEnabled = useHasPermissions(
    ['settings:security:write'],
    [`write:::settings/security/${setting}/*`],
  );

  return isEnabled;
};

export const SecuritySettings = () => {
  const settings = useSettings();
  const mutateTenantSettings = useUpdateTenantSettings();
  const isMfaEnabled = useSecuritySettings('mfa');
  const isPasswordExpirationEnabled = useSecuritySettings('password-expiration');
  const isAccountDormancyEnabled = useSecuritySettings('account-dormancy');
  const isSessionTimeoutEnabled = useSecuritySettings('session-timeout');
  const isConcurrentSessionsEnabled = useSecuritySettings('concurrent-sessions');
  const isBruteForceEnabled = useSecuritySettings('brute-force');

  const handleMfaDisable = () => {
    mutateTenantSettings.mutate({ mfaEnabled: false });
  };

  const handleMfaEnable = () => {
    mutateTenantSettings.mutate({ mfaEnabled: true });
  };

  const handleBruteForceAccountBlockingEnable = () => {
    mutateTenantSettings.mutate({ bruteForceAccountBlockingEnabled: true });
  };

  const handleBruteForceAccountBlockingDisable = () => {
    mutateTenantSettings.mutate({ bruteForceAccountBlockingEnabled: false });
  };

  const isLoading = useCallback(
    (variable) => {
      return (
        mutateTenantSettings.isLoading &&
        Boolean(Object.keys(mutateTenantSettings.variables ?? {}).find((key) => key === variable))
      );
    },
    [mutateTenantSettings.variables, mutateTenantSettings.isLoading],
  );

  const handleSessionTimeoutChange = (value: number | undefined) => {
    mutateTenantSettings.mutate(
      { sessionTimeoutMinutes: value },
      {
        onSuccess: () => {
          window.location.reload();
        },
      },
    );
  };

  return (
    <Fragment>
      <SettingsCard
        title="MFA"
        description="When enabled, users will be required to use Multi-Factor Authentication to access the platform using any Authenticator app."
        minRequiredResources={['read:::settings/security/mfa/*']}
      >
        <Toggle
          onChange={!settings.mfaEnabled ? handleMfaEnable : handleMfaDisable}
          value={settings.mfaEnabled}
          isLoading={mutateTenantSettings.isLoading || isLoading('mfaEnabled')}
          isDisabled={!isMfaEnabled}
        />
      </SettingsCard>
      <SettingsCard
        title="Password expiration policy"
        description="Select when the password of a user should expire."
        minRequiredResources={['read:::settings/security/password-expiration/*']}
      >
        <Select
          value={settings.passwordResetDays}
          onChange={(selectedValue) => {
            mutateTenantSettings.mutate({ passwordResetDays: selectedValue });
          }}
          options={passwordResetDaysOptions}
          allowClear={false}
          isLoading={mutateTenantSettings.isLoading}
          style={{ width: '40%' }}
          isDisabled={!isPasswordExpirationEnabled || isLoading('passwordResetDays')}
        />
      </SettingsCard>

      <SettingsCard
        title="Account dormancy period"
        description="The account will be suspended if no activity is detected for the selected number of days."
        minRequiredResources={['read:::settings/security/account-dormancy/*']}
      >
        <Select
          value={settings.accountDormancyAllowedDays}
          onChange={(selectedValue) => {
            mutateTenantSettings.mutate({ accountDormancyAllowedDays: selectedValue });
          }}
          options={accountDormancyAllowedDaysOptions}
          isLoading={mutateTenantSettings.isLoading}
          allowClear={false}
          style={{ width: '40%' }}
          isDisabled={!isAccountDormancyEnabled || isLoading('accountDormancyAllowedDays')}
        />
      </SettingsCard>

      <SettingsCard
        title="Session timeout"
        description="The time period after which a user's session will timeout if they are inactive."
        minRequiredResources={['read:::settings/security/session-timeout/*']}
      >
        <Select
          value={settings.sessionTimeoutMinutes}
          onChange={handleSessionTimeoutChange}
          options={sessionTimeoutOptions}
          isLoading={mutateTenantSettings.isLoading}
          allowClear={false}
          style={{ width: '40%' }}
          isDisabled={!isSessionTimeoutEnabled || isLoading('sessionTimeoutMinutes')}
        />
      </SettingsCard>
      <SettingsCard
        title="Max concurrent sessions"
        description="The maximum number of concurrent sessions a user can have."
        minRequiredResources={['read:::settings/security/concurrent-sessions/*']}
      >
        <Select
          value={settings.maxActiveSessions}
          onChange={(selectedValue) => {
            // setting 0 as undefined, to reset maxActiveSession
            mutateTenantSettings.mutate({
              maxActiveSessions: selectedValue === 0 ? undefined : selectedValue,
            });
          }}
          options={maxActiveSessionsOptions}
          isLoading={mutateTenantSettings.isLoading}
          allowClear={false}
          style={{ width: '40%' }}
          isDisabled={!isConcurrentSessionsEnabled || isLoading('maxActiveSessions')}
        />
      </SettingsCard>
      <SettingsCard
        title="Brute force account blocking"
        description={`When enabled, the account will be blocked after ${MAX_LOGIN_ATTEMPTS_BEFORE_BLOCKING} failed login attempts.`}
        minRequiredResources={['read:::settings/security/brute-force/*']}
      >
        <Toggle
          onChange={
            !settings.bruteForceAccountBlockingEnabled
              ? handleBruteForceAccountBlockingEnable
              : handleBruteForceAccountBlockingDisable
          }
          value={settings.bruteForceAccountBlockingEnabled}
          isLoading={mutateTenantSettings.isLoading || isLoading('bruteForceAccountBlocking')}
          isDisabled={!isBruteForceEnabled}
        />
      </SettingsCard>
    </Fragment>
  );
};

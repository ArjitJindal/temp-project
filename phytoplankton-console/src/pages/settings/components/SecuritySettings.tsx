import { Fragment, useCallback } from 'react';
import SettingsCard from '@/components/library/SettingsCard';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Toggle from '@/components/library/Toggle';
import { useHasPermissions } from '@/utils/user-utils';
import SelectionGroup from '@/components/library/SelectionGroup';

export const SecuritySettings = () => {
  const settings = useSettings();
  const permissions = useHasPermissions(['settings:organisation:write']);
  const mutateTenantSettings = useUpdateTenantSettings();
  const isSettingsEnabled = useHasPermissions(['settings:organisation:write']);
  const handleDisable = () => {
    mutateTenantSettings.mutate({ mfaEnabled: false });
  };

  const handleEnable = () => {
    mutateTenantSettings.mutate({ mfaEnabled: true });
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
      >
        <Toggle
          onChange={!settings.mfaEnabled ? handleEnable : handleDisable}
          value={settings.mfaEnabled}
          loading={mutateTenantSettings.isLoading || isLoading('mfaEnabled')}
          isDisabled={!permissions}
        />
      </SettingsCard>
      <SettingsCard
        title="Password expiration policy"
        description="Select when the password of a user should expire."
      >
        <SelectionGroup<number>
          mode={'SINGLE'}
          value={settings.passwordResetDays ?? 0}
          onChange={(value) => {
            mutateTenantSettings.mutate({ passwordResetDays: value });
          }}
          isLoading={mutateTenantSettings.isLoading}
          options={[
            { label: 'No limit', value: 0, tooltip: 'Password will never expire' },
            { label: '1 day', value: 1 }, // Just for Testing
            { label: '30 days', value: 30 },
            { label: '45 days', value: 45 },
            { label: '2 months', value: 60 },
            { label: '3 months', value: 90 },
            { label: '6 months', value: 180 },
            { label: '1 year', value: 365 },
          ]}
          isDisabled={!isSettingsEnabled || isLoading('passwordResetDays')}
        />
      </SettingsCard>

      <SettingsCard
        title="Account dormancy period"
        description="The account will be suspended if no activity is detected for the selected number of days."
      >
        <SelectionGroup<number>
          mode={'SINGLE'}
          value={settings.accountDormancyAllowedDays ?? 0}
          onChange={(value) => mutateTenantSettings.mutate({ accountDormancyAllowedDays: value })}
          isLoading={mutateTenantSettings.isLoading}
          options={[
            {
              label: 'No limit',
              value: 0,
              tooltip: 'Accounts will not be suspended due to dormancy.',
            },
            { label: '1 day', value: 1 }, // Just for Testing
            { label: '45 days', value: 45 },
            { label: '2 months', value: 60 },
            { label: '3 months', value: 90 },
            { label: '6 months', value: 180 },
            { label: '1 year', value: 365 },
          ]}
          isDisabled={!isSettingsEnabled || isLoading('accountDormancyAllowedDays')}
        />
      </SettingsCard>
      <SettingsCard
        title="Session timeout"
        description="The time period after which a user's session will timeout if they are inactive."
      >
        <SelectionGroup<number>
          mode={'SINGLE'}
          value={settings.sessionTimeoutMinutes}
          onChange={(value) => handleSessionTimeoutChange(value)}
          options={[
            { label: 'Default', value: 0 },
            { label: '15 minutes', value: 15 },
            { label: '30 minutes', value: 30 },
            { label: '45 minutes', value: 45 },
            { label: '1 hour', value: 60 },
            { label: '24 hours', value: 1440 },
            { label: '48 hours', value: 2880 },
          ]}
          isDisabled={!isSettingsEnabled}
        />
      </SettingsCard>
      <SettingsCard
        title="Max concurrent sessions"
        description="The maximum number of concurrent sessions a user can have."
      >
        <SelectionGroup<number>
          mode={'SINGLE'}
          value={settings.maxActiveSessions ?? 0}
          onChange={(value) => {
            mutateTenantSettings.mutate({ maxActiveSessions: value });
          }}
          isLoading={mutateTenantSettings.isLoading}
          options={[
            { label: 'No limit', value: 0 },
            { label: '1', value: 1 },
            { label: '2', value: 2 },
            { label: '3', value: 3 },
          ]}
          isDisabled={!isSettingsEnabled || isLoading('maxActiveSessions')}
        />
      </SettingsCard>
    </Fragment>
  );
};

import { Fragment } from 'react';
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

  return (
    <Fragment>
      <SettingsCard
        title="MFA"
        description="When enabled, users will be required to use Multi-Factor Authentication to access the platform using any Authenticator app."
      >
        <Toggle
          onChange={!settings.mfaEnabled ? handleEnable : handleDisable}
          value={settings.mfaEnabled}
          loading={mutateTenantSettings.isLoading}
          isDisabled={!permissions}
        />
      </SettingsCard>
      <SettingsCard
        title="Password expiration policy"
        description="Select when the password of a user should expire."
      >
        <SelectionGroup<number>
          mode={'SINGLE'}
          value={settings.passwordResetDays}
          onChange={(value) => {
            mutateTenantSettings.mutate({ passwordResetDays: value });
          }}
          options={[
            { label: 'No limit', value: 0, description: 'Password will never expire' },
            { label: '30 days', value: 30 },
            { label: '45 days', value: 45 },
            { label: '2 months', value: 60 },
            { label: '3 months', value: 90 },
            { label: '6 months', value: 180 },
            { label: '1 year', value: 365 },
          ]}
          isDisabled={!isSettingsEnabled}
        />
      </SettingsCard>

      <SettingsCard
        title="Account dormancy Period"
        description="The number of days after which an account will be considered dormant and will be suspended."
      >
        <SelectionGroup<number>
          mode={'SINGLE'}
          value={settings.accountDormancyAllowedDays}
          onChange={(value) => mutateTenantSettings.mutate({ accountDormancyAllowedDays: value })}
          options={[
            {
              label: 'No limit',
              value: 0,
              description: 'Accounts will not be suspended due to dormancy.',
            },
            { label: '45 days', value: 45 },
            { label: '2 months', value: 60 },
            { label: '3 months', value: 90 },
            { label: '6 months', value: 180 },
            { label: '1 year', value: 365 },
          ]}
          isDisabled={!isSettingsEnabled}
        />
      </SettingsCard>
    </Fragment>
  );
};

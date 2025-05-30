import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import SettingsCard from '@/components/library/SettingsCard';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Toggle from '@/components/library/Toggle';
import Tooltip from '@/components/library/Tooltip';
import { useHasPermissions } from '@/utils/user-utils';

export const KYCUserStatusSettings = () => {
  const settings = useSettings();
  const permissions = useHasPermissions(
    ['settings:users:write'],
    ['write:::settings/users/kyc-user-status-lock/*'],
  );

  const mutateTenantSettings = useUpdateTenantSettings();
  const handleDisable = () => {
    mutateTenantSettings.mutate({ kycUserStatusLock: false });
  };

  const handleEnable = () => {
    mutateTenantSettings.mutate({ kycUserStatusLock: true });
  };

  const capitalizeUserAlias = firstLetterUpper(settings.userAlias);

  return (
    <SettingsCard
      title={`KYC/${capitalizeUserAlias} status lock`}
      description={`When enabled, prevents editing of 'KYC status' and '${settings.userAlias} status' fields on ${settings.userAlias} details page.`}
      minRequiredResources={['read:::settings/users/kyc-user-status-lock/*']}
    >
      <Tooltip
        title={
          !permissions ? `${capitalizeUserAlias} must have permissions to update settings` : ''
        }
      >
        <Toggle
          value={settings.kycUserStatusLock}
          onChange={settings.kycUserStatusLock ? handleDisable : handleEnable}
          isLoading={mutateTenantSettings.isLoading}
          isDisabled={!permissions}
        />
      </Tooltip>
    </SettingsCard>
  );
};

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
  const permissions = useHasPermissions(['settings:users:write']);

  const mutateTenantSettings = useUpdateTenantSettings();
  const handleDisable = () => {
    mutateTenantSettings.mutate({ kycUserStatusLock: false });
  };

  const handleEnable = () => {
    mutateTenantSettings.mutate({ kycUserStatusLock: true });
  };

  return (
    <SettingsCard
      title="KYC/user status lock"
      description="When enabled, prevents editing of 'KYC status' and 'User status' fields on user details page."
    >
      <Tooltip title={!permissions ? 'User must have permissions to update settings' : ''}>
        <Toggle
          value={settings.kycUserStatusLock}
          onChange={settings.kycUserStatusLock ? handleDisable : handleEnable}
          loading={mutateTenantSettings.isLoading}
          disabled={!permissions}
        />
      </Tooltip>
    </SettingsCard>
  );
};

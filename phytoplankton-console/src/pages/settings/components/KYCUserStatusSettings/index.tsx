import SettingsCard from '@/components/library/SettingsCard';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Toggle from '@/components/library/Toggle';
import { isAtLeastAdmin, useAuth0User } from '@/utils/user-utils';
import Tooltip from '@/components/library/Tooltip';

export const KYCUserStatusSettings = () => {
  const settings = useSettings();
  const user = useAuth0User();

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
      <Tooltip title={!isAtLeastAdmin(user) ? 'User must be at least an admin' : ''}>
        <Toggle
          value={settings.kycUserStatusLock}
          onChange={settings.kycUserStatusLock ? handleDisable : handleEnable}
          loading={mutateTenantSettings.isLoading}
          disabled={!isAtLeastAdmin(user)}
        />
      </Tooltip>
    </SettingsCard>
  );
};

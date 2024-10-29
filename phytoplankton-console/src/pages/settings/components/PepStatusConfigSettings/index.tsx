import SettingsCard from '@/components/library/SettingsCard';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Toggle from '@/components/library/Toggle';
import { isAtLeastAdmin, useAuth0User } from '@/utils/user-utils';
import Tooltip from '@/components/library/Tooltip';

export const PepStatusConfigSettings = () => {
  const settings = useSettings();
  const user = useAuth0User();

  const mutateTenantSettings = useUpdateTenantSettings();
  const handleDisable = () => {
    mutateTenantSettings.mutate({ pepStatusLock: false });
  };

  const handleEnable = () => {
    mutateTenantSettings.mutate({ pepStatusLock: true });
  };

  return (
    <SettingsCard
      title="PEP status lock"
      description="When enabled, prevents editing of PEP status on user details page."
    >
      <Tooltip title={!isAtLeastAdmin(user) ? 'User must be at least an admin' : ''}>
        <Toggle
          value={settings.pepStatusLock}
          onChange={settings.pepStatusLock ? handleDisable : handleEnable}
          loading={mutateTenantSettings.isLoading}
          disabled={!isAtLeastAdmin(user)}
        />
      </Tooltip>
    </SettingsCard>
  );
};

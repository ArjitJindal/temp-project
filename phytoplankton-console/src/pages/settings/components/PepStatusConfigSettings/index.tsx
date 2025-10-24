import SettingsCard from '@/components/library/SettingsCard';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Toggle from '@/components/library/Toggle';
import Tooltip from '@/components/library/Tooltip';
import { useHasResources } from '@/utils/user-utils';

export const PepStatusConfigSettings = () => {
  const settings = useSettings();
  const permissions = useHasResources(['write:::settings/users/pep-status-lock/*']);

  const mutateTenantSettings = useUpdateTenantSettings({ enableReloadSettings: true });
  const handleDisable = () => {
    mutateTenantSettings.mutate({ pepStatusLock: false });
  };

  const handleEnable = () => {
    mutateTenantSettings.mutate({ pepStatusLock: true });
  };

  return (
    <SettingsCard
      title="PEP status lock"
      description={`When enabled, prevents editing of PEP status on ${settings.userAlias} details page.`}
      minRequiredResources={['read:::settings/users/pep-status-lock/*']}
    >
      <Tooltip title={!permissions ? 'User must have permissions to update settings' : ''}>
        <Toggle
          value={settings.pepStatusLock}
          onChange={settings.pepStatusLock ? handleDisable : handleEnable}
          isLoading={mutateTenantSettings.isLoading}
          isDisabled={!permissions}
        />
      </Tooltip>
    </SettingsCard>
  );
};

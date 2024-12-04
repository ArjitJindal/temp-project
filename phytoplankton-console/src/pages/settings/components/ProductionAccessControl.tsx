import SettingsCard from '@/components/library/SettingsCard';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { message } from '@/components/library/Message';
import Toggle from '@/components/library/Toggle';
import { useAuth0User, useHasPermissions } from '@/utils/user-utils';

export const ProductionAccessControl = () => {
  const settings = useSettings();
  const user = useAuth0User();
  const mutateTenantSettings = useUpdateTenantSettings();
  const hasSystemConfigWrite = useHasPermissions(['settings:system-config:write']);

  const handleToggleOff = () => {
    if (user.tenantId === 'flagright') {
      message.warn(
        'Cannot disable production access control for Flagright tenant or in non-production environment. Please contact Flagright support.',
      );
      return;
    }

    mutateTenantSettings.mutate({ isProductionAccessEnabled: false });
  };

  const handleToggleOn = () => {
    mutateTenantSettings.mutate({ isProductionAccessEnabled: true });
  };

  return (
    <SettingsCard
      title="Production access control"
      description="When enabled, Flagright support team can access the production environment for troubleshooting & bug fixes."
    >
      <Toggle
        onChange={!settings.isProductionAccessEnabled ? handleToggleOn : handleToggleOff}
        value={settings.isProductionAccessEnabled}
        loading={mutateTenantSettings.isLoading}
        disabled={!hasSystemConfigWrite}
      />
    </SettingsCard>
  );
};

import SettingsCard from './SettingsCard';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { message } from '@/components/library/Message';
import Toggle from '@/components/library/Toggle';
import { useAuth0User } from '@/utils/user-utils';

export const ProductionAccessControl = () => {
  const settings = useSettings();
  const user = useAuth0User();
  const mutateTenantSettings = useUpdateTenantSettings();
  const handleDisable = () => {
    if (user.tenantId === 'flagright') {
      message.warn(
        'Cannot disable production access control for Flagright tenant or in non-production environment. Please contact Flagright support.',
      );
      return;
    }

    mutateTenantSettings.mutate({ isProductionAccessEnabled: false });
  };

  const handleEnable = () => {
    mutateTenantSettings.mutate({ isProductionAccessEnabled: true });
  };

  return (
    <SettingsCard
      title="Production access control"
      description="When enabled, Flagright support team can access the production environment for troubleshooting & bug fixes."
    >
      <Toggle
        onChange={!settings.isProductionAccessEnabled ? handleEnable : handleDisable}
        value={settings.isProductionAccessEnabled}
        loading={mutateTenantSettings.isLoading}
      />
    </SettingsCard>
  );
};

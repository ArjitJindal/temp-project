import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { message } from '@/components/library/Message';
import Toggle from '@/components/library/Toggle';
import { H3 } from '@/components/ui/Typography';
import { useAuth0User } from '@/utils/user-utils';

export const ProductionAccessControl = () => {
  const settings = useSettings();
  const user = useAuth0User();
  const mutateTenantSettings = useUpdateTenantSettings();
  const handleDisable = () => {
    if (user.tenantId === 'flagright' || !process.env.ENV?.startsWith('prod')) {
      message.warn(
        'Cannot disable production access control for Flagright tenant or in non-production environment',
      );
      return;
    }

    mutateTenantSettings.mutate({ isProductionAccessEnabled: false });
  };

  const handleEnable = () => {
    mutateTenantSettings.mutate({ isProductionAccessEnabled: true });
  };

  return (
    <div>
      <H3>Production access control</H3>
      <p>
        When enabled, Flagright support team can access the production environment for
        troubleshooting & bug fixes.
      </p>
      <div style={{ marginTop: '2rem' }}>
        <Toggle
          onChange={!settings.isProductionAccessEnabled ? handleEnable : handleDisable}
          value={settings.isProductionAccessEnabled}
          loading={mutateTenantSettings.isLoading}
        />
      </div>
    </div>
  );
};

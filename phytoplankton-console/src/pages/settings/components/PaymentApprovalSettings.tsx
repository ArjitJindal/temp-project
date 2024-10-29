import SettingsCard from '@/components/library/SettingsCard';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Toggle from '@/components/library/Toggle';
import { useHasPermissions } from '@/utils/user-utils';

export const PaymentApprovalSettings = () => {
  const settings = useSettings();
  const mutateTenantSettings = useUpdateTenantSettings();
  const handleDisable = () => {
    mutateTenantSettings.mutate({ isPaymentApprovalEnabled: false });
  };

  const handleEnable = () => {
    mutateTenantSettings.mutate({ isPaymentApprovalEnabled: true });
  };

  const permissions = useHasPermissions(['settings:transactions:write']);

  return (
    <div>
      <SettingsCard
        title="Payment approval"
        description="Turn on manual approval for all transactions with ‘SUSPEND’ state rule action in case
          management for transaction rules."
      >
        <div>
          <Toggle
            onChange={!settings.isPaymentApprovalEnabled ? handleEnable : handleDisable}
            value={settings.isPaymentApprovalEnabled}
            loading={mutateTenantSettings.isLoading}
            disabled={!permissions}
          />
        </div>
      </SettingsCard>
    </div>
  );
};

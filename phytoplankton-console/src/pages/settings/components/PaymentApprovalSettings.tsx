import SettingsCard from '@/components/library/SettingsCard';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Toggle from '@/components/library/Toggle';
import { useHasResources } from '@/utils/user-utils';

export const PaymentApprovalSettings = () => {
  const settings = useSettings();
  const mutateTenantSettings = useUpdateTenantSettings({ enableReloadSettings: true });
  const handleDisable = () => {
    mutateTenantSettings.mutate({ isPaymentApprovalEnabled: false });
  };

  const handleEnable = () => {
    mutateTenantSettings.mutate({ isPaymentApprovalEnabled: true });
  };

  const permissions = useHasResources(['write:::settings/transactions/payment-approval/*']);

  return (
    <div>
      <SettingsCard
        title="Payment approval"
        description="Turn on manual approval for all transactions with ‘SUSPEND’ state rule action in case
          management for transaction rules."
        minRequiredResources={['read:::settings/transactions/payment-approval/*']}
      >
        <div>
          <Toggle
            onChange={!settings.isPaymentApprovalEnabled ? handleEnable : handleDisable}
            value={settings.isPaymentApprovalEnabled}
            isLoading={mutateTenantSettings.isLoading}
            isDisabled={!permissions}
          />
        </div>
      </SettingsCard>
    </div>
  );
};

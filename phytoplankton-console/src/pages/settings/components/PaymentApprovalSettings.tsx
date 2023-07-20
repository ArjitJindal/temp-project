import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Toggle from '@/components/library/Toggle';

export const PaymentApprovalSettings = () => {
  const settings = useSettings();
  const mutateTenantSettings = useUpdateTenantSettings();
  const handleDisable = () => {
    mutateTenantSettings.mutate({ isPaymentApprovalEnabled: false });
  };

  const handleEnable = () => {
    mutateTenantSettings.mutate({ isPaymentApprovalEnabled: true });
  };

  return (
    <div>
      <h3>Payment Approval</h3>
      <p>
        Turn on manual approval for all transactions with ‘SUSPEND’ state rule action in case
        management for transaction rules.
      </p>
      <div style={{ marginTop: '2rem' }}>
        <Toggle
          onChange={!settings.isPaymentApprovalEnabled ? handleEnable : handleDisable}
          value={settings.isPaymentApprovalEnabled}
          loading={mutateTenantSettings.isLoading}
        />
      </div>
    </div>
  );
};

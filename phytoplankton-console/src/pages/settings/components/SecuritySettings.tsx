import SettingsCard from '@/components/library/SettingsCard';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Toggle from '@/components/library/Toggle';

export const SecuritySettings = () => {
  const settings = useSettings();
  const mutateTenantSettings = useUpdateTenantSettings();
  const handleDisable = () => {
    mutateTenantSettings.mutate({ mfaEnabled: false });
  };

  const handleEnable = () => {
    mutateTenantSettings.mutate({ mfaEnabled: true });
  };

  return (
    <SettingsCard
      title="MFA"
      description="When enabled, users will be required to use Multi-Factor Authentication to access the platform using any Authenticator app."
    >
      <Toggle
        onChange={!settings.mfaEnabled ? handleEnable : handleDisable}
        value={settings.mfaEnabled}
        loading={mutateTenantSettings.isLoading}
      />
    </SettingsCard>
  );
};

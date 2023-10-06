import SettingsCard from '@/components/library/SettingsCard';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Toggle from '@/components/library/Toggle';

export const KYCUserStatusSettings = () => {
  const settings = useSettings();

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
      <Toggle
        value={settings.kycUserStatusLock}
        onChange={settings.kycUserStatusLock ? handleDisable : handleEnable}
        loading={mutateTenantSettings.isLoading}
      />
    </SettingsCard>
  );
};

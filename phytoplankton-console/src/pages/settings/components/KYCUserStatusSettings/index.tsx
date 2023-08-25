import s from './index.module.less';
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
    <div>
      <h3>KYC/user status lock</h3>
      <p className={s.description}>
        When enabled, prevents editing of 'KYC status' and 'user status' fields on user details
        page.
      </p>
      <br />

      <Toggle
        value={settings.kycUserStatusLock}
        onChange={settings.kycUserStatusLock ? handleDisable : handleEnable}
        loading={mutateTenantSettings.isLoading}
      />
    </div>
  );
};

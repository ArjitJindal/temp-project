import { useCallback, useState } from 'react';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import s from './style.module.less';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import SettingsCard from '@/components/library/SettingsCard';
import TextInput from '@/components/library/TextInput';
import Button from '@/components/library/Button';
import { KYC_STATUSS } from '@/apis/models-custom/KYCStatus';
import { USER_STATES } from '@/apis/models-custom/UserState';
import { UserStateAlias } from '@/apis/models/UserStateAlias';
import { KYCStatusAlias } from '@/apis/models/KYCStatusAlias';
import { UserState } from '@/apis/models/UserState';
import { KYCStatus } from '@/apis/models/KYCStatus';
import { humanizeKYCStatus } from '@/components/utils/humanizeKYCStatus';

const StatusAliasSettings = () => {
  const settings = useSettings();
  const mutateTenantSettings = useUpdateTenantSettings();

  const [userStateAliasMap, setUserStateAliasMap] = useState<Map<UserState, string>>(
    new Map((settings.userStateAlias || []).map((alias) => [alias.state, alias.alias])),
  );

  const [kycStatusAliasMap, setKycStatusAliasMap] = useState<Map<KYCStatus, string>>(
    new Map((settings.kycStatusAlias || []).map((alias) => [alias.state, alias.alias])),
  );

  const handleUserStateAliasChange = useCallback((state: UserState, value: string) => {
    setUserStateAliasMap((prev) => new Map(prev).set(state, value));
  }, []);

  const handleKycStatusAliasChange = useCallback((state: KYCStatus, value: string) => {
    setKycStatusAliasMap((prev) => new Map(prev).set(state, value));
  }, []);

  const handleUpdateUserStateAlias = useCallback(
    async (state: UserState) => {
      const alias = userStateAliasMap.get(state) || '';
      const existingAliases = (settings.userStateAlias || []).filter(
        (item) => item.state !== state,
      );
      const userStateAlias = [
        ...existingAliases,
        { state, alias: alias.trim() },
      ] as UserStateAlias[];
      await mutateTenantSettings.mutateAsync({ userStateAlias });
    },
    [settings.userStateAlias, userStateAliasMap, mutateTenantSettings],
  );

  const handleUpdateKycStatusAlias = useCallback(
    async (state: KYCStatus) => {
      const alias = kycStatusAliasMap.get(state) || '';
      const existingAliases = (settings.kycStatusAlias || []).filter(
        (item) => item.state !== state,
      );
      const kycStatusAlias = [
        ...existingAliases,
        { state, alias: alias.trim() },
      ] as KYCStatusAlias[];
      await mutateTenantSettings.mutateAsync({ kycStatusAlias });
    },
    [settings.kycStatusAlias, kycStatusAliasMap, mutateTenantSettings],
  );

  const hasUserStateChanged = useCallback(
    (state: UserState) => {
      const currentValue = userStateAliasMap.get(state) || '';
      const settingsAlias = settings.userStateAlias?.find((a) => a.state === state);
      const originalValue = settingsAlias?.alias || '';
      return originalValue !== currentValue;
    },
    [settings.userStateAlias, userStateAliasMap],
  );

  const hasKycStatusChanged = useCallback(
    (state: KYCStatus) => {
      const currentValue = kycStatusAliasMap.get(state) || '';
      const settingsAlias = settings.kycStatusAlias?.find((a) => a.state === state);
      const originalValue = settingsAlias?.alias || '';
      return originalValue !== currentValue;
    },
    [settings.kycStatusAlias, kycStatusAliasMap],
  );

  return (
    <>
      <SettingsCard
        title="User status alias"
        description="Configure the user's status display name in the console"
        minRequiredResources={['read:::settings/users/user-alias/*']}
      >
        <div className={s.root}>
          {USER_STATES.map((item) => {
            const value = userStateAliasMap.get(item) || '';
            const isChanged = hasUserStateChanged(item);

            return (
              <div className={s.labelItem} key={item}>
                <p className={s.aliasLabel}>{humanizeAuto(item)}</p>
                <div className={s.inputItem}>
                  <div className={s.inputContainer}>
                    <TextInput
                      name={`userStateAlias.${item}`}
                      value={value}
                      onChange={(newValue) => {
                        handleUserStateAliasChange(item, newValue || '');
                      }}
                    />
                  </div>
                  <Button
                    onClick={() => handleUpdateUserStateAlias(item)}
                    isLoading={mutateTenantSettings.isLoading}
                    isDisabled={!isChanged}
                  >
                    Update
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </SettingsCard>
      <SettingsCard
        title="KYC status alias"
        description="Configure the KYC status display name in the console"
        minRequiredResources={['read:::settings/users/user-alias/*']}
      >
        <div className={s.root}>
          {KYC_STATUSS.map((item) => {
            const value = kycStatusAliasMap.get(item) || '';
            const isChanged = hasKycStatusChanged(item);

            return (
              <div className={s.labelItem} key={item}>
                <p className={s.aliasLabel}>{humanizeKYCStatus(item)}</p>
                <div className={s.inputItem}>
                  <div className={s.inputContainer}>
                    <TextInput
                      name={`kycStatusAlias.${item}`}
                      value={value}
                      onChange={(newValue) => {
                        handleKycStatusAliasChange(item, newValue || '');
                      }}
                    />
                  </div>
                  <Button
                    onClick={() => handleUpdateKycStatusAlias(item)}
                    isLoading={mutateTenantSettings.isLoading}
                    isDisabled={!isChanged}
                  >
                    Update
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </SettingsCard>
    </>
  );
};

export default StatusAliasSettings;

import SettingsCard from '@/components/library/SettingsCard';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Toggle from '@/components/library/Toggle';
import { useHasResources } from '@/utils/user-utils';

export const DecimalSettings = () => {
  const settings = useSettings();
  const mutateTenantSettings = useUpdateTenantSettings();

  const handleToggle = (showAllDecimalPlaces: boolean | undefined) => {
    if (showAllDecimalPlaces != null) {
      mutateTenantSettings.mutate({ showAllDecimalPlaces: showAllDecimalPlaces ? false : true });
    }
  };

  const permissions = useHasResources(['write:::settings/transactions/show-all-decimal-places/*']);

  return (
    <SettingsCard
      title="Show all decimal places"
      description="When enabled, transaction amounts will display with full precision instead of being rounded to two decimals."
      minRequiredResources={['read:::settings/transactions/show-all-decimal-places/*']}
    >
      <div>
        <Toggle
          onChange={handleToggle}
          value={settings.showAllDecimalPlaces ?? false}
          isLoading={mutateTenantSettings.isLoading}
          isDisabled={!permissions}
        />
      </div>
    </SettingsCard>
  );
};

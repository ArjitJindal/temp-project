import SettingsCard from '@/components/library/SettingsCard';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Toggle from '@/components/library/Toggle';
import { useHasPermissions } from '@/utils/user-utils';

export default function CraToggleSettings() {
  const settings = useSettings();
  const mutateTenantSettings = useUpdateTenantSettings();
  const permissions = useHasPermissions(['settings:risk-scoring:write']);
  const handleDisable = () => {
    mutateTenantSettings.mutate({ riskScoringCraEnabled: false });
  };

  const handleEnable = () => {
    mutateTenantSettings.mutate({ riskScoringCraEnabled: true });
  };

  return (
    <div>
      <SettingsCard
        title="Risk scoring CRA"
        description={`Turn on risk scoring CRA for all ${settings.userAlias}s`}
      >
        <div>
          <Toggle
            onChange={settings.riskScoringCraEnabled === false ? handleEnable : handleDisable}
            value={settings.riskScoringCraEnabled ?? true}
            isLoading={mutateTenantSettings.isLoading}
            isDisabled={!permissions}
          />
        </div>
      </SettingsCard>
    </div>
  );
}

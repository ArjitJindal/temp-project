import SettingsCard from '@/components/library/SettingsCard';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Toggle from '@/components/library/Toggle';

export default function CraToggleSettings() {
  const settings = useSettings();
  const mutateTenantSettings = useUpdateTenantSettings();
  const handleDisable = () => {
    mutateTenantSettings.mutate({ riskScoringCraEnabled: false });
  };

  const handleEnable = () => {
    mutateTenantSettings.mutate({ riskScoringCraEnabled: true });
  };

  return (
    <div>
      <SettingsCard title="Risk scoring CRA" description="Turn on risk scoring CRA for all users">
        <div>
          <Toggle
            onChange={settings.riskScoringCraEnabled === true ? handleDisable : handleEnable}
            value={settings.riskScoringCraEnabled ?? true}
            loading={mutateTenantSettings.isLoading}
          />
        </div>
      </SettingsCard>
    </div>
  );
}

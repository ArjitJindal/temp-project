import SettingsCard from '@/components/library/SettingsCard';
import {
  useFeatureEnabled,
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { isWhiteLabeled } from '@/utils/branding';
import Toggle from '@/components/library/Toggle';
import Tooltip from '@/components/library/Tooltip';

const whiteLabeled = isWhiteLabeled();

export const FlagrightMLSettings = () => {
  const settings = useSettings();
  const hasMachineLearningFeature = useFeatureEnabled('MACHINE_LEARNING');

  const mutateTenantSettings = useUpdateTenantSettings();
  const handleToggle = () => {
    mutateTenantSettings.mutate({ isMlEnabled: !settings.isMlEnabled });
  };
  return (
    <div>
      {
        <SettingsCard
          title={whiteLabeled ? 'AI detections' : 'Flagright AI detections'}
          description="Enable ‘Flagright AI’ Machine learning detection models to be used during rule configuration."
        >
          {hasMachineLearningFeature ? (
            <Toggle
              value={settings.isMlEnabled}
              onChange={handleToggle}
              loading={mutateTenantSettings.isLoading}
            />
          ) : (
            <Tooltip
              title={`Contact us to purchase machine learning features.`}
              placement="topLeft"
            >
              <div>
                <Toggle value={false} disabled={true} />
              </div>
            </Tooltip>
          )}
        </SettingsCard>
      }
    </div>
  );
};

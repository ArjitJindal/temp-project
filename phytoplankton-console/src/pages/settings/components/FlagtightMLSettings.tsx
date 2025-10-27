import SettingsCard from '@/components/library/SettingsCard';
import {
  useFeatureEnabled,
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { isWhiteLabeled } from '@/utils/branding';
import Toggle from '@/components/library/Toggle';
import Tooltip from '@/components/library/Tooltip';
import { useHasResources } from '@/utils/user-utils';

const whiteLabeled = isWhiteLabeled();

export const FlagrightMLSettings = () => {
  const permissions = useHasResources(['read:::settings/add-ons/ai-detections/*']);
  const settings = useSettings();
  const hasMachineLearningFeature = useFeatureEnabled('MACHINE_LEARNING');

  const mutateTenantSettings = useUpdateTenantSettings({ enableReloadSettings: true });
  const handleToggle = () => {
    mutateTenantSettings.mutate({ isMlEnabled: !settings.isMlEnabled });
  };
  return (
    <div>
      {
        <SettingsCard
          title={whiteLabeled ? 'AI detections' : 'Flagright AI detections'}
          description="Enable Flagright AI detection models. Models are deployed from the Rules module."
          minRequiredResources={['read:::settings/add-ons/ai-detections/*']}
        >
          {hasMachineLearningFeature ? (
            <Toggle
              value={settings.isMlEnabled}
              onChange={handleToggle}
              isLoading={mutateTenantSettings.isLoading}
              isDisabled={!permissions}
            />
          ) : (
            <Tooltip
              title={`Contact us to purchase machine learning features.`}
              placement="topRight"
            >
              <div>
                <Toggle value={false} isDisabled={true} />
              </div>
            </Tooltip>
          )}
        </SettingsCard>
      }
    </div>
  );
};

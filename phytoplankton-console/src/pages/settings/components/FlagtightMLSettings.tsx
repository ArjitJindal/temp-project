import SettingsCard from '@/components/library/SettingsCard';
import {
  useFeatureEnabled,
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { isWhiteLabeled } from '@/utils/branding';
import Toggle from '@/components/library/Toggle';
import Tooltip from '@/components/library/Tooltip';
import { useHasPermissions } from '@/utils/user-utils';

const whiteLabeled = isWhiteLabeled();

export const FlagrightMLSettings = () => {
  const permissions = useHasPermissions(['settings:add-ons:read']);
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
              isDisabled={!permissions}
            />
          ) : (
            <Tooltip
              title={`Contact us to purchase machine learning features.`}
              placement="topLeft"
            >
              <div>
                <Toggle value={false} disabled={true} isDisabled={!permissions} />
              </div>
            </Tooltip>
          )}
        </SettingsCard>
      }
    </div>
  );
};

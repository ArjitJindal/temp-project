import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import SelectionGroup from '@/components/library/SelectionGroup';
import SettingsCard from '@/components/library/SettingsCard';
import Tooltip from '@/components/library/Tooltip';
import { useAuth0User, UserRole } from '@/utils/user-utils';

export const NarrativeCopilot = () => {
  const settings = useSettings();
  const settingsMutaion = useUpdateTenantSettings();
  const user = useAuth0User();

  if (!settings.isAiEnabled) {
    return <></>;
  }

  return (
    <SettingsCard
      title="Narrative copilot"
      description="Configure how you want Flagright AI to write your narratives."
    >
      <Tooltip
        title={user.role !== UserRole.ADMIN ? 'User must be an admin to perform this action' : ''}
      >
        <SelectionGroup
          mode="SINGLE"
          value={settings.narrativeMode ?? 'STANDARD'}
          onChange={(newValue) => {
            settingsMutaion.mutate({
              narrativeMode: newValue,
            });
          }}
          isDisabled={user.role !== UserRole.ADMIN}
          options={[
            {
              value: 'STANDARD',
              label: 'Standard',
              description: 'Standard narratives. Contain more data. Typically 4-5 paragraphs',
            },
            {
              value: 'COMPACT',
              label: 'Compact',
              description: 'Shorter narratives. Typically one to two paragraphs.',
            },
          ]}
        />
      </Tooltip>
    </SettingsCard>
  );
};

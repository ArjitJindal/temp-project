import s from './style.module.less';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import SelectionGroup from '@/components/library/SelectionGroup';
import SettingsCard from '@/components/library/SettingsCard';
import { H4, P } from '@/components/ui/Typography';
import { useHasResources } from '@/utils/user-utils';
import Checkbox from '@/components/library/Checkbox';
import Label from '@/components/library/Label';

export const NarrativeCopilot = () => {
  const settings = useSettings();
  const settingsMutaion = useUpdateTenantSettings();
  const isComponentAccessible = useHasResources(['write:::settings/case-management/*']);
  if (!settings.isAiEnabled) {
    return <></>;
  }

  return (
    <SettingsCard
      title="Narrative copilot"
      description="Configure how you want Flagright AI to write your narratives."
      info={
        !isComponentAccessible ? 'User must have permission to write, to perform this action' : ''
      }
      minRequiredResources={['read:::settings/case-management/narrative-copilot/*']}
    >
      <>
        <H4 className={s.heading}>Default narrative mode</H4>
        <P grey variant="m" className={s.description}>
          Set a default narrative type for Flagright AI to automatically generate a narrative when a
          case or alert is closed.
        </P>
        <SelectionGroup
          mode="SINGLE"
          value={settings.narrativeMode ?? 'STANDARD'}
          onChange={(newValue) => {
            settingsMutaion.mutate({
              narrativeMode: newValue,
            });
          }}
          isDisabled={!isComponentAccessible}
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
        <div className={s.checkboxContainer}>
          <Label label="Allow to update manually at case management" position="RIGHT" level={2}>
            <Checkbox
              size="M"
              value={settings.allowManualNarrativeModeUpdates ?? false}
              onChange={(checked) => {
                settingsMutaion.mutate({ allowManualNarrativeModeUpdates: checked });
              }}
              isDisabled={!isComponentAccessible}
            />
          </Label>
        </div>
      </>
    </SettingsCard>
  );
};

import React from 'react';
import s from './styles.module.less';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import SelectionGroup from '@/components/library/SelectionGroup';
import SettingsCard from '@/components/library/SettingsCard';
import { ReRunTrigger } from '@/apis';
import { useHasResources } from '@/utils/user-utils';

const options: { label: string; value: ReRunTrigger }[] = [
  {
    label: 'SAR',
    value: 'SAR',
  },
  {
    label: 'Lists',
    value: 'LIST',
  },
];

function ReRunTriggerSettings() {
  const settings = useSettings();
  const updateTenantSettings = useUpdateTenantSettings();
  const permissions = useHasResources(['write:::settings/risk-scoring/rerun-trigger-settings/*']);
  return (
    <SettingsCard
      title="Re-run trigger settings"
      minRequiredResources={['read:::settings/risk-scoring/rerun-trigger-settings/*']}
    >
      <div className={s.root}>
        <SelectionGroup
          mode="MULTIPLE"
          options={options}
          value={settings.reRunRiskScoringTriggers}
          onChange={(value) => {
            if (value) {
              updateTenantSettings.mutate({ reRunRiskScoringTriggers: value });
            }
          }}
          isDisabled={!permissions}
        />
      </div>
    </SettingsCard>
  );
}

export default ReRunTriggerSettings;

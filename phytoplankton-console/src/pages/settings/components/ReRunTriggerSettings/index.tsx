import React from 'react';
import s from './styles.module.less';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import SelectionGroup from '@/components/library/SelectionGroup';
import SettingsCard from '@/components/library/SettingsCard';
import { ReRunTrigger } from '@/apis';

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
  return (
    <SettingsCard title="Re-run trigger settings">
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
        />
      </div>
    </SettingsCard>
  );
}

export default ReRunTriggerSettings;

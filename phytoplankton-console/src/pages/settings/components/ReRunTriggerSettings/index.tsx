import React from 'react';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import s from './styles.module.less';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import SelectionGroup from '@/components/library/SelectionGroup';
import SettingsCard from '@/components/library/SettingsCard';
import { ReRunTrigger } from '@/apis';
import { useHasResources } from '@/utils/user-utils';

function ReRunTriggerSettings() {
  const settings = useSettings();

  const options: { label: string; value: ReRunTrigger }[] = [
    {
      label: 'SAR filling',
      value: 'SAR',
    },
    {
      label: `${humanizeAuto(settings.userAlias ?? 'User')} ID update on lists`,
      value: 'LIST',
    },
  ];

  const updateTenantSettings = useUpdateTenantSettings();
  const permissions = useHasResources(['write:::settings/risk-scoring/rerun-trigger-settings/*']);
  return (
    <SettingsCard
      title="Re-run risk scoring calculation on"
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

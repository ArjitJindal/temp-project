import { useState } from 'react';
import SettingsCard from '@/components/library/SettingsCard';
import SelectionGroup from '@/components/library/SelectionGroup';
import { useHasResources } from '@/utils/user-utils';

export const RiskAlgorithmsSettings = () => {
  const permissions = useHasResources(['write:::settings/risk-scoring/risk-algorithms/*']);
  const [value, setValue] = useState<string>('HEURISTIC');
  return (
    <SettingsCard
      title="Risk algorithms"
      description="Select the algorithm type for transaction monitoring."
      minRequiredResources={['read:::settings/risk-scoring/risk-algorithms/*']}
    >
      <p style={{ border: 'none' }}>
        <b>Algorithm type</b>
      </p>
      <SelectionGroup
        mode={'SINGLE'}
        value={value == null ? 'HEURISTIC' : value}
        options={[
          {
            label: 'Heuristic',
            value: 'HEURISTIC',
            description:
              'Use Heuristic based risk levels for your transaction monitoring. This risk score is calculated using your manually set risk factors.',
          },
        ]}
        isDisabled={!permissions}
        onChange={(newValue) => {
          setValue(newValue ?? 'AI');
        }}
      />
    </SettingsCard>
  );
};

import { useState } from 'react';
import SelectionGroup from '@/components/library/SelectionGroup';
import { getBranding } from '@/utils/branding';

export const RiskAlgorithmsSettings = () => {
  const [value, setValue] = useState<string>('HEURISTIC');
  const [modelValue, setModalValue] = useState<string>('IF');
  const branding = getBranding();

  return (
    <div>
      <h3>Risk algorithms</h3>
      <p>Select the algorithm type you want to use for transaction monitoring.</p>
      <br />
      <p>
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
          {
            label: `${branding.companyName} AI`,
            value: 'AI',
            description: `Use risk levels calculated by ${branding.companyName}'s AI model of your choice for your transaction monitoring`,
          },
        ]}
        onChange={(newValue) => {
          setValue(newValue ?? 'AI');
        }}
      />
      {value === 'AI' && (
        <>
          <br />
          <p>
            <b>Model Type</b>
          </p>
          <SelectionGroup
            mode={'SINGLE'}
            value={modelValue == null ? 'IF' : modelValue}
            options={[
              {
                label: 'Isolation Forest',
                value: 'IF',
                description: `Use ${branding.companyName}'s Isolation forest model to risk score your users`,
              },
              {
                label: 'XGBoost',
                value: 'XG',
                description: `Use ${branding.companyName}'s XGBoost model to risk score your users(this model needs 1000 closed cases at least to be effective)`,
              },
              {
                label: 'Graph Learning',
                value: 'GF',
                description: `Use ${branding.companyName}'s Graph learning model - this is experimental`,
              },
              {
                label: 'Gaussian Mixture',
                value: 'GM',
                description: `Use ${branding.companyName}'s Gaussian mixture model - this is experimental`,
              },
            ]}
            onChange={(newValue) => {
              setModalValue(newValue ?? 'IF');
            }}
          />
        </>
      )}
    </div>
  );
};

import React, { useState, useCallback } from 'react';
import s from './styles.module.less';
import SelectionGroup from '@/components/library/SelectionGroup';
import SettingsCard from '@/components/library/SettingsCard';
import NumberInput from '@/components/library/NumberInput';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Label from '@/components/library/Label';
import Button from '@/components/library/Button';

type RiskAlgorithmsType = 'FORMULA_LEGACY_MOVING_AVG' | 'FORMULA_SIMPLE_AVG' | 'FORMULA_CUSTOM';

function RiskAlgorithmsCra() {
  const settings = useSettings();
  const isCraEnabled = settings.riskScoringCraEnabled ?? false;
  const currentAlgorithm = settings.riskScoringAlgorithm;
  const mutateTenantSettings = useUpdateTenantSettings();
  const [algorithmType, setAlgorithmType] = useState<RiskAlgorithmsType>(
    settings.riskScoringAlgorithm?.type ?? 'FORMULA_LEGACY_MOVING_AVG',
  );
  const [localKrsWeight, setLocalKrsWeight] = useState(
    currentAlgorithm?.type === 'FORMULA_CUSTOM' ? currentAlgorithm?.krsWeight ?? 0.5 : 0.5,
  );

  const handleUpdateRiskAlgorithm = useCallback(() => {
    if (algorithmType === 'FORMULA_CUSTOM') {
      mutateTenantSettings.mutate({
        riskScoringAlgorithm: {
          type: algorithmType,
          krsWeight: localKrsWeight ?? 0.5,
          avgTrsWeight: Number((1 - (localKrsWeight ?? 0.5)).toFixed(1)),
        },
      });
    } else {
      mutateTenantSettings.mutate({
        riskScoringAlgorithm: {
          type: algorithmType,
        },
      });
    }
  }, [mutateTenantSettings, algorithmType, localKrsWeight]);

  return isCraEnabled ? (
    <SettingsCard title={'Risk algorithms for CRA'}>
      <div className={s.algorithmsContainer}>
        <SelectionGroup
          mode={'SINGLE'}
          value={algorithmType}
          options={[
            {
              label: 'Current',
              value: 'FORMULA_LEGACY_MOVING_AVG',
              description: 'Moving average between KRS and avg TRS',
            },
            {
              label: 'Default',
              value: 'FORMULA_SIMPLE_AVG',
              description: 'Simple average between KRS and avg TRS',
            },
            {
              label: 'Custom',
              value: 'FORMULA_CUSTOM',
              description:
                'Choose the weight of KRS and avg TRS in calculating the CRA risk score.',
            },
          ]}
          onChange={(newValue) => {
            setAlgorithmType(newValue as RiskAlgorithmsType);
          }}
        />
      </div>
      {algorithmType === 'FORMULA_CUSTOM' && (
        <div className={s.customContainer}>
          <Label
            label={
              <p className={s.customHeading}>
                Select weight of KRS and average TRS (Weight of KRS + Weight of avg TRS = 1)
              </p>
            }
            required={{ value: true, showHint: true }}
          />
          <div className={s.weightInputRoot}>
            <div>
              <Label
                label={<p className={s.customHeading}>KRS weight (0 to 1)</p>}
                required={{ value: true, showHint: true }}
              />
              <NumberInput
                value={localKrsWeight}
                onChange={(value) => {
                  if (value !== undefined) {
                    setLocalKrsWeight(value);
                  }
                }}
                max={1}
                min={0}
                step={0.1}
              />
            </div>
            <div>
              <Label
                label={<p className={s.customHeading}>Avg TRS weight (0 to 1)</p>}
                required={{ value: true, showHint: true }}
              />
              <NumberInput
                value={Number((1 - localKrsWeight).toFixed(1))}
                onChange={(value) => {
                  if (value !== undefined) {
                    setLocalKrsWeight(Number((1 - value).toFixed(1)));
                  }
                }}
                max={1}
                min={0}
                step={0.1}
              />
            </div>
          </div>
        </div>
      )}
      <div className={s.buttonContainer}>
        <Button onClick={handleUpdateRiskAlgorithm} isDisabled={mutateTenantSettings.isLoading}>
          Update
        </Button>
      </div>
    </SettingsCard>
  ) : null;
}

export default RiskAlgorithmsCra;

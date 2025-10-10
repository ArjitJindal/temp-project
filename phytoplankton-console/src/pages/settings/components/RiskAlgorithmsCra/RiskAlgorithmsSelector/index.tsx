import React from 'react';
import s from './styles.module.less';
import SelectionGroup from '@/components/library/SelectionGroup';
import NumberInput from '@/components/library/NumberInput';
import Label from '@/components/library/Label';
import { FormulaCustom, FormulaLegacyMovingAvg, FormulaSimpleAvg } from '@/apis';

export type RiskAlgorithmsType =
  | 'FORMULA_LEGACY_MOVING_AVG'
  | 'FORMULA_SIMPLE_AVG'
  | 'FORMULA_CUSTOM';

export type RiskScoringCraAlgorithm = FormulaCustom | FormulaLegacyMovingAvg | FormulaSimpleAvg;

interface Props {
  hasPermissions: boolean;
  handleUpdateAlgorithm: (algorithm: RiskScoringCraAlgorithm) => void;
  isUpdateDisabled: boolean;
  currentAlgorithm?: RiskScoringCraAlgorithm;
  defaultAlgorithmType: RiskAlgorithmsType;
}
function serialiseAlgorithmChange(
  riskAlgorithmType: RiskAlgorithmsType,
  krsWeight?: number,
): RiskScoringCraAlgorithm {
  if (riskAlgorithmType === 'FORMULA_CUSTOM') {
    return {
      type: 'FORMULA_CUSTOM',
      krsWeight: krsWeight ?? 0.5,
      avgArsWeight: Number((1 - (krsWeight ?? 0.5)).toFixed(1)),
    };
  } else {
    return {
      type: riskAlgorithmType,
    };
  }
}

function RiskAlgorithmsSelector(props: Props) {
  const {
    hasPermissions,
    handleUpdateAlgorithm,
    isUpdateDisabled,
    defaultAlgorithmType,
    currentAlgorithm,
  } = props;

  return (
    <>
      <div className={s.algorithmsContainer}>
        <SelectionGroup
          mode={'SINGLE'}
          value={currentAlgorithm?.type ?? defaultAlgorithmType}
          options={[
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
            {
              label: 'Moving average',
              value: 'FORMULA_LEGACY_MOVING_AVG',
              description: 'Moving average between KRS and latest CRA',
            },
          ]}
          onChange={(newValue) => {
            handleUpdateAlgorithm(serialiseAlgorithmChange(newValue ?? defaultAlgorithmType, 0.5));
          }}
          isDisabled={!hasPermissions || isUpdateDisabled}
        />
      </div>
      {currentAlgorithm?.type === 'FORMULA_CUSTOM' && (
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
                value={currentAlgorithm.krsWeight ?? 0.5}
                onChange={(value) => {
                  if (value !== undefined) {
                    handleUpdateAlgorithm(serialiseAlgorithmChange(currentAlgorithm.type, value));
                  }
                }}
                max={1}
                min={0}
                step={0.1}
                isDisabled={!hasPermissions}
              />
            </div>
            <div>
              <Label
                label={<p className={s.customHeading}>Avg TRS weight (0 to 1)</p>}
                required={{ value: true, showHint: true }}
              />
              <NumberInput
                value={Number((1 - (currentAlgorithm.krsWeight ?? 0.5)).toFixed(1))}
                onChange={(value) => {
                  if (value !== undefined) {
                    handleUpdateAlgorithm(
                      serialiseAlgorithmChange(
                        currentAlgorithm.type,
                        Number((1 - value).toFixed(1)),
                      ),
                    );
                  }
                }}
                max={1}
                min={0}
                step={0.1}
                isDisabled={!hasPermissions}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default RiskAlgorithmsSelector;

import React, { useState } from 'react';
import { humanizeStrings } from '@flagright/lib/utils/humanize';
import { FormValues } from '../index';
import { RISK_LEVELS, RiskLevel } from '@/utils/risk-levels';
import { getRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Label from '@/components/library/Label';
import Select from '@/components/library/Select';
import Alert from '@/components/library/Alert';
import Button from '@/components/library/Button';
import { isEqual } from '@/utils/lang';
import { RiskLevelRuleParameters } from '@/apis/models/RiskLevelRuleParameters';
import { message } from '@/components/library/Message';

interface Props {
  currentRiskLevel: RiskLevel;
  defaultInitialValues: RiskLevelRuleParameters | undefined;
  formValues: FormValues;
  onConfirm: (chosenLevels: RiskLevel[]) => void;
}

export default function ApplyRiskLevels(props: Props) {
  const { currentRiskLevel, defaultInitialValues, formValues, onConfirm } = props;
  const settings = useSettings();
  const [chosenLevels, setChosenLevels] = useState<RiskLevel[]>([]);
  const isAnyLevelChanged = chosenLevels.some((x) => {
    const riskLevelParameters = formValues.riskLevelParameters?.[x];
    if (riskLevelParameters == null) {
      return false;
    }
    return !isEqual(riskLevelParameters, defaultInitialValues?.[x]);
  });
  return (
    <>
      <Label label={'Apply to other risk levels'}>
        <Select<RiskLevel>
          mode="MULTIPLE"
          allowNewOptions
          options={RISK_LEVELS.filter((x) => x !== currentRiskLevel).map((riskLevel) => ({
            value: riskLevel,
            label: getRiskLevelLabel(riskLevel, settings),
          }))}
          value={chosenLevels}
          onChange={(newValue) => {
            setChosenLevels(newValue ?? []);
          }}
        />
      </Label>
      {isAnyLevelChanged && (
        <Alert type={'WARNING'}>
          You have selected an already configured risk level. Clicking on ‘Apply’ will override the
          older configuration
        </Alert>
      )}
      <div>
        <Button
          isDisabled={chosenLevels.length === 0}
          type="PRIMARY"
          onClick={() => {
            onConfirm(chosenLevels);
            setChosenLevels([]);
            message.success(
              `Settings applied to ${humanizeStrings(
                chosenLevels.map((riskLevel) => getRiskLevelLabel(riskLevel, settings)),
              )} risk levels`,
            );
          }}
        >
          Apply
        </Button>
      </div>
    </>
  );
}

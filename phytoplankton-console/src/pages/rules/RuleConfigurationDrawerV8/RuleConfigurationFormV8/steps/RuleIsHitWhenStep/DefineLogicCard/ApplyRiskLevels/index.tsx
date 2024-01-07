import React, { useState } from 'react';
import SubCard from '../SubCard';
import s from './style.module.less';
import Label from '@/components/library/Label';
import Select from '@/components/library/Select';
import { RiskLevel, RISK_LEVELS } from '@/utils/risk-levels';
import { getRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';

interface Props {
  currentRiskLevel: RiskLevel;
}

export default function ApplyToOtherLevelsCard(props: Props) {
  const { currentRiskLevel } = props;
  const settings = useSettings();
  const [chosenLevels, setChosenLevels] = useState<RiskLevel[]>([]);
  return (
    <SubCard>
      <Label
        label={'Apply to other risk levels'}
        description="This option lets you apply the configured settings to multiple risk levels, saving time"
      >
        <div className={s.inputs}>
          <Select<RiskLevel>
            mode="TAGS"
            options={RISK_LEVELS.filter((x) => x !== currentRiskLevel).map((riskLevel) => ({
              value: riskLevel,
              label: getRiskLevelLabel(riskLevel, settings),
            }))}
            value={chosenLevels}
            onChange={(newValue) => {
              setChosenLevels(newValue ?? []);
            }}
          />
          <Button
            onClick={() => {
              throw new Error(`Not supported yet`);
            }}
          >
            Apply
          </Button>
        </div>
      </Label>
    </SubCard>
  );
}

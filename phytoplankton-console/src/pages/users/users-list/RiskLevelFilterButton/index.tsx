import React from 'react';
import PopupContent from './PopupContent';
import AlarmWarningFillIcon from '@/components/ui/icons/Remix/system/alarm-warning-fill.react.svg';
import { RiskLevel } from '@/apis';
import QuickFilterBase from '@/components/library/QuickFilter/QuickFilterBase';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { levelToAlias } from '@/utils/risk-levels';

interface Props {
  riskLevels: RiskLevel[];
  onConfirm: (risk: RiskLevel[]) => void;
  onUpdateFilterClose?: (status: boolean) => void;
}

export function RiskLevelButton(props: Props) {
  const { riskLevels, onConfirm, onUpdateFilterClose } = props;
  const isEmpty = riskLevels.length === 0;
  const configSetting = useSettings();
  const configRiskLevelAlias = configSetting?.riskLevelAlias;
  const riskLevelAlias = configRiskLevelAlias
    ? riskLevels.map((level) => levelToAlias(level, configRiskLevelAlias))
    : riskLevels;

  return (
    <QuickFilterBase
      icon={<AlarmWarningFillIcon />}
      analyticsName="risk-filter"
      title="CRA"
      buttonText={isEmpty ? undefined : riskLevelAlias.join(', ')}
      onClear={
        isEmpty
          ? undefined
          : () => {
              onConfirm([]);
            }
      }
      onUpdateFilterClose={onUpdateFilterClose}
    >
      <PopupContent value={riskLevels} onConfirm={onConfirm} />
    </QuickFilterBase>
  );
}

import React from 'react';
import PopupContent from './PopupContent';
import AlarmWarningFillIcon from '@/components/ui/icons/Remix/system/alarm-warning-fill.react.svg';
import { RiskLevel } from '@/apis';
import QuickFilterBase from '@/components/library/QuickFilter/QuickFilterBase';

interface Props {
  riskLevels: RiskLevel[];
  onConfirm: (risk: RiskLevel[]) => void;
}

export function RiskLevelButton(props: Props) {
  const { riskLevels, onConfirm } = props;

  const isEmpty = riskLevels.length === 0;

  return (
    <QuickFilterBase
      icon={<AlarmWarningFillIcon />}
      analyticsName="risk-filter"
      title="CRA"
      buttonText={isEmpty ? undefined : riskLevels.join(', ')}
      onClear={
        isEmpty
          ? undefined
          : () => {
              onConfirm([]);
            }
      }
    >
      <PopupContent value={riskLevels} onConfirm={onConfirm} />
    </QuickFilterBase>
  );
}

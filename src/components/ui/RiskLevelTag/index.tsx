import { PresetStatusColorType } from 'antd/lib/_util/colors';
import { Tag } from 'antd';
import React from 'react';
import { neverReturn } from '@/utils/lang';
import { RiskLevel, RISK_LEVEL_LABELS } from '@/utils/risk-levels';

interface Props {
  level: RiskLevel;
}

export default function RiskLevelTag(props: Props): JSX.Element {
  let color: PresetStatusColorType;
  switch (props.level) {
    case 'VERY_LOW':
      color = 'success';
      break;
    case 'LOW':
      color = 'success';
      break;
    case 'MEDIUM':
      color = 'warning';
      break;
    case 'HIGH':
      color = 'error';
      break;
    case 'VERY_HIGH':
      color = 'error';
      break;
    default:
      color = neverReturn(props.level, 'default');
  }
  return <Tag color={color}>{RISK_LEVEL_LABELS[props.level]}</Tag>;
}

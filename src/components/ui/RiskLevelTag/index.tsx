import { Tag } from 'antd';
import React from 'react';
import { RISK_LEVEL_COLORS, RISK_LEVEL_LABELS, RiskLevel } from '@/utils/risk-levels';

interface Props {
  level: RiskLevel;
}

export default function RiskLevelTag(props: Props): JSX.Element {
  const color = RISK_LEVEL_COLORS[props.level];
  return (
    <Tag style={{ background: color.light, borderColor: color.primary, color: color.text }}>
      {RISK_LEVEL_LABELS[props.level]}
    </Tag>
  );
}

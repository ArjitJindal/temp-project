import { Tag } from 'antd';
import React from 'react';
import { RISK_LEVEL_COLORS, RiskLevel } from '@/utils/risk-levels';
import { getRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  level: RiskLevel | undefined;
}

export default function RiskLevelTag(props: Props): JSX.Element {
  const { level } = props;
  const settings = useSettings();
  if (!level) {
    return <>-</>;
  }
  const color = RISK_LEVEL_COLORS[level];
  return (
    <Tag style={{ background: color.light, borderColor: color.primary, color: color.text }}>
      {getRiskLevelLabel(level, settings)}
    </Tag>
  );
}

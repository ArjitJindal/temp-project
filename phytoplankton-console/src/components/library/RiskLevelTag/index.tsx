import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import { RISK_LEVEL_COLORS, RiskLevel } from '@/utils/risk-levels';
import { getRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { humanizeConstant } from '@/utils/humanize';

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
    <div className={s.root}>
      <div
        className={cn(s.content)}
        style={{ background: color.light, borderColor: color.primary, color: color.text }}
      >
        {humanizeConstant(getRiskLevelLabel(level, settings))}
      </div>
    </div>
  );
}

import React from 'react';
import cn from 'clsx';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
import { RiskLevel } from '@/utils/risk-levels';
import { getRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Tag from '@/components/library/Tag';

interface Props {
  level: RiskLevel | undefined;
}

export default function RiskLevelTag(props: Props): JSX.Element {
  const { level } = props;
  const settings = useSettings();
  if (!level) {
    return <>-</>;
  }
  const { riskLevelLabel, isActive } = getRiskLevelLabel(level, settings);
  return (
    <div className={s.level}>
      <Tag className={cn(s.root, s[`level-${level}`])}>{humanizeConstant(riskLevelLabel)}</Tag>
      {!isActive && <Tag className={s.inActive}>Inactive</Tag>}
    </div>
  );
}

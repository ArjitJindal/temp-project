import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import { RiskLevel } from '@/utils/risk-levels';
import { getRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { humanizeConstant } from '@/utils/humanize';
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
  return (
    <Tag className={cn(s.root, s[`level-${level}`])}>
      {humanizeConstant(getRiskLevelLabel(level, settings))}
    </Tag>
  );
}

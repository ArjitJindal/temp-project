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
  return (
    <div className={s.level}>
      <Tag
        className={cn(
          s.root,
          s[`level-${level}`],
          getRiskLevelLabel(level, settings).isActive && s.active,
        )}
      >
        {humanizeConstant(getRiskLevelLabel(level, settings).riskLevelLabel)}
      </Tag>
      {!getRiskLevelLabel(level, settings).isActive && (
        <Tag className={cn(s.root, s[`inactive`])}>Inactive</Tag>
      )}
    </div>
  );
}

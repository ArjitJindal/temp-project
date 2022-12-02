import { Tag } from 'antd';
import React from 'react';
import { useRiskActionLabel } from '../AppWrapper/Providers/SettingsProvider';
import { getRuleActionColor } from '../../utils/rules';
import { RuleAction } from '@/apis';

interface Props {
  ruleAction: RuleAction;
}

export const RuleActionTag: React.FC<Props> = ({ ruleAction }) => {
  const ruleActionLabel = useRiskActionLabel(ruleAction);
  return (
    <span>
      <Tag color={getRuleActionColor(ruleAction)}>{ruleActionLabel}</Tag>
    </span>
  );
};

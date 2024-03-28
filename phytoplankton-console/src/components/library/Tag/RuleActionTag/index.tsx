import { Badge } from 'antd';
import React from 'react';
import { useRuleActionLabel } from '../../../AppWrapper/Providers/SettingsProvider';
import { RuleAction } from '@/apis';
import { getRuleActionColor } from '@/utils/rules';

interface Props {
  ruleAction: RuleAction;
}

export const RuleActionTag: React.FC<Props> = ({ ruleAction }) => {
  const ruleActionLabel = useRuleActionLabel(ruleAction);
  return (
    <span>
      <Badge color={getRuleActionColor(ruleAction)} text={ruleActionLabel} />
    </span>
  );
};

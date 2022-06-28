import { Tag } from 'antd';
import React from 'react';
import { RuleAction } from '@/apis';

function getRuleActionColor(ruleAction: RuleAction): string {
  if (ruleAction === 'ALLOW') {
    return 'green';
  } else if (ruleAction === 'BLOCK') {
    return 'red';
  } else if (ruleAction === 'FLAG') {
    return 'orange';
  } else if (ruleAction === 'WHITELIST') {
    return 'lime';
  } else {
    return 'yellow';
  }
}

interface Props {
  action: RuleAction;
}

export const RuleActionTag: React.FC<Props> = ({ action }) => {
  return <Tag color={getRuleActionColor(action)}>{action}</Tag>;
};

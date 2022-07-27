import { Tag } from 'antd';
import React from 'react';
import _ from 'lodash';
import { useSettings } from '../AppWrapper/Providers/SettingsProvider';
import { useRuleActionTitle, useRuleActionColor } from '../../utils/rules';
import { RuleAction } from '@/apis';

interface Props {
  ruleAction: RuleAction;
}

export const RuleActionTag: React.FC<Props> = ({ ruleAction }) => {
  const settings = useSettings();
  const alias = settings.ruleActionAliases?.find((item) => item.action === ruleAction)?.alias;
  return (
    <span>
      <Tag color={useRuleActionColor(ruleAction)}>{useRuleActionTitle(alias || ruleAction)}</Tag>
    </span>
  );
};

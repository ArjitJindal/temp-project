import { RuleAction } from '@/apis/models/RuleAction';

export const RULE_ACTION_OPTIONS: { label: string; value: RuleAction }[] = [
  { label: 'Flag', value: 'FLAG' },
  { label: 'Block', value: 'BLOCK' },
  { label: 'Whitelist', value: 'WHITELIST' },
];

export function getRuleActionColor(ruleAction: RuleAction): string {
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

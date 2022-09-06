import { RuleAction } from '@/apis/models/RuleAction';

export const RULE_ACTION_OPTIONS: { label: string; value: RuleAction }[] = [
  { label: 'Flag', value: 'FLAG' },
  { label: 'Suspend', value: 'SUSPEND' },
  { label: 'Block', value: 'BLOCK' },
  { label: 'Whitelist', value: 'WHITELIST' },
];

export function getRuleInstanceDisplayId(ruleId: string, ruleInstanceId: string | undefined) {
  return `${ruleId} (${ruleInstanceId || 'N/A'})`;
}

import { CasePriority, RuleNature } from '@/apis';
import { RuleAction } from '@/apis/models/RuleAction';
import { RuleInstanceMap, RulesMap } from '@/utils/rules';

export const RULE_ACTION_OPTIONS: { label: string; value: RuleAction }[] = [
  { label: 'Flag', value: 'FLAG' },
  { label: 'Suspend', value: 'SUSPEND' },
  { label: 'Block', value: 'BLOCK' },
];

export function getRuleInstanceDisplayId(ruleId: string, ruleInstanceId: string | undefined) {
  return `${ruleId} (${ruleInstanceId || 'N/A'})`;
}

export function ruleHeaderKeyToDescription(key: string) {
  const keyToDescription = {
    'rules-library': 'Create a transaction monitoring rule with a straight-forward 3 step process',
    'my-rules': 'List of all your rules. Activate/deactivate them in one click',
  };
  if (Object.hasOwn(keyToDescription, key)) {
    return keyToDescription[key];
  }
  return '';
}

export function getRuleInstanceDisplay(
  ruleId: string,
  ruleInstanceId: string | undefined,
  rules: RulesMap,
  ruleInstances: RuleInstanceMap,
) {
  return ruleInstances[ruleInstanceId as string]?.ruleNameAlias || rules[ruleId]?.name || ruleId;
}

export const RULE_NATURE_OPTIONS: { label: string; value: RuleNature }[] = [
  { label: 'AML', value: 'AML' },
  { label: 'Fraud', value: 'FRAUD' },
];

export const RULE_CASE_PRIORITY: { label: string; value: CasePriority }[] = [
  { label: 'P1', value: 'P1' },
  { label: 'P2', value: 'P2' },
  { label: 'P3', value: 'P3' },
  { label: 'P4', value: 'P4' },
];

import { RuleInstance } from '@/apis';
import { getRuleInstanceDisplayId } from '@/pages/rules/utils';

export const RECENT_RULE_SEARCHES_KEY = 'recent-rule-searches';

export function getRuleInstanceTitle(ruleInstance: RuleInstance): string {
  if (ruleInstance?.ruleNameAlias) {
    return ruleInstance.ruleNameAlias;
  }
  return getRuleInstanceDisplayId(ruleInstance.ruleId, ruleInstance.id);
}

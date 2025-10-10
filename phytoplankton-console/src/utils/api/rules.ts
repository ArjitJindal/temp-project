import { RuleInstance } from '@/apis';
import { getRuleInstanceDisplayId } from '@/pages/rules/utils';

export function getRuleInstanceTitle(ruleInstance: RuleInstance): string {
  if (ruleInstance?.ruleNameAlias) {
    return ruleInstance.ruleNameAlias;
  }
  return getRuleInstanceDisplayId(ruleInstance.ruleId, ruleInstance.id);
}

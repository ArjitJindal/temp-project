import { traverse } from '@flagright/lib/utils';
import { cloneDeep, get, reduce, set } from 'lodash';
import { RiskLevelRuleLogic, RuleInstance, VarThresholdData } from '@/apis';

export const EMPTY_THRESHOLD_DATA = {
  varKey: '',
  threshold: 0,
  timeReduced: 0,
  falsePositivesReduced: 0,
  transactionsHit: 0,
  usersHit: 0,
};

export const UPDATED_VAR_DATA_KEY = `UPDATED_VAR_DATA`;

export function updateCurrentInstance(
  ruleInstance: RuleInstance,
  varThresholdData: VarThresholdData,
): RuleInstance {
  const newLogic = cloneDeep(ruleInstance.logic);
  traverse(ruleInstance.logic, (key, value, path) => {
    if (value === varThresholdData.varKey && key === 'var') {
      set(newLogic, path.slice(0, -2), [
        get(ruleInstance.logic, path.slice(0, -2))[0],
        varThresholdData.threshold,
      ]);
    }
  });
  const riskLevelLogic = reduce(
    ruleInstance.riskLevelLogic,
    (prev, _curr, key) => {
      prev[key] = newLogic;
      return prev;
    },
    {},
  );
  return { ...ruleInstance, logic: newLogic, riskLevelLogic: riskLevelLogic as RiskLevelRuleLogic };
}

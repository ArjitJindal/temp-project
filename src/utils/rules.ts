import _ from 'lodash';
import { useMemo } from 'react';
import { useQuery } from './queries/hooks';
import { RULES, RULE_INSTANCES } from './queries/keys';
import {
  CaseCreationType,
  HitRulesResult,
  Rule,
  RuleAction,
  RuleInstance,
  TransactionState,
} from '@/apis';
import { neverReturn } from '@/utils/lang';
import COLORS from '@/components/ui/colors';
import { useApi } from '@/api';

export const RULE_ACTION_VALUES: RuleAction[] = ['ALLOW', 'WHITELIST', 'FLAG', 'BLOCK', 'SUSPEND'];

export function isRuleAction(value: unknown): value is RuleAction {
  const asRuleAction = value as RuleAction;
  switch (asRuleAction) {
    case 'ALLOW':
    case 'FLAG':
    case 'BLOCK':
    case 'WHITELIST':
    case 'SUSPEND':
      return true;
  }
  return neverReturn(asRuleAction, false);
}

export function isTransactionState(value: unknown): value is TransactionState {
  const asState = value as TransactionState;
  switch (asState) {
    case 'CREATED':
    case 'PROCESSING':
    case 'SENT':
    case 'EXPIRED':
    case 'DECLINED':
    case 'SUSPENDED':
    case 'REFUNDED':
    case 'SUCCESSFUL':
      return true;
  }
  return neverReturn(asState, false);
}

export function getRuleActionTitle(ruleAction: RuleAction | string): string {
  return _.capitalize(ruleAction);
}

export function getRuleActionColor(ruleAction: RuleAction): string {
  if (ruleAction === 'ALLOW') {
    return COLORS.brandBlue.base;
  }
  if (ruleAction === 'SUSPEND') {
    return COLORS.yellow.base;
  }
  if (ruleAction === 'BLOCK') {
    return COLORS.red.base;
  }
  if (ruleAction === 'WHITELIST') {
    return COLORS.brandBlue.base;
  }
  if (ruleAction === 'FLAG') {
    return COLORS.orange.base;
  }
  return neverReturn(ruleAction, 'gray');
}

export type RuleInstanceMap = { [key: string]: RuleInstance };
export type RulesMap = { [key: string]: Rule };

export function useRules(): { rules: RulesMap; ruleInstances: RuleInstanceMap } {
  const api = useApi();
  const rulesResults = useQuery(RULES(), (): Promise<Rule[]> => api.getRules({}));
  const ruleInstanceResults = useQuery(
    RULE_INSTANCES(),
    (): Promise<RuleInstance[]> => api.getRuleInstances({}),
  );
  const rulesMap = useMemo(() => {
    if (rulesResults.data.kind === 'SUCCESS') {
      return _.keyBy(rulesResults.data.value, 'id');
    } else {
      return {};
    }
  }, [rulesResults.data]);
  const ruleInstancesMap = useMemo(() => {
    if (ruleInstanceResults.data.kind === 'SUCCESS') {
      return _.keyBy(ruleInstanceResults.data.value, 'id');
    } else {
      return {};
    }
  }, [ruleInstanceResults.data]);

  return { rules: rulesMap, ruleInstances: ruleInstancesMap };
}

export function filterRulesHitByCaseCreationType(
  rules: HitRulesResult[],
  caseCreationType: CaseCreationType,
): HitRulesResult[] {
  return rules.filter(
    (rule) =>
      !rule?.ruleHitMeta?.caseCreationType ||
      rule?.ruleHitMeta?.caseCreationType === caseCreationType,
  );
}

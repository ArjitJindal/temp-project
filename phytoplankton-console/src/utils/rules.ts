import { useMemo } from 'react';
import { keyBy } from 'lodash';
import { useQuery } from './queries/hooks';
import { RULE_INSTANCES, RULES } from './queries/keys';
import { Rule, RuleAction, RuleInstance, TransactionState } from '@/apis';
import { neverReturn } from '@/utils/lang';
import COLORS, {
  COLORS_V2_ALERT_SUCCESS,
  COLORS_V2_ALERT_WARNING,
  COLORS_V2_ANALYTICS_CHARTS_01,
  COLORS_V2_ANALYTICS_CHARTS_02,
  COLORS_V2_ANALYTICS_CHARTS_03,
  COLORS_V2_ANALYTICS_CHARTS_04,
  COLORS_V2_RISK_LEVEL_BASE_HIGH,
} from '@/components/ui/colors';
import { useApi } from '@/api';

export const RULE_ACTION_VALUES: RuleAction[] = ['ALLOW', 'FLAG', 'BLOCK', 'SUSPEND'];

export function isRuleAction(value: unknown): value is RuleAction {
  const asRuleAction = value as RuleAction;
  switch (asRuleAction) {
    case 'ALLOW':
    case 'FLAG':
    case 'BLOCK':
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

export function getRuleActionColorForDashboard(ruleAction: RuleAction): string {
  if (ruleAction === 'ALLOW') {
    return COLORS_V2_ANALYTICS_CHARTS_01;
  }
  if (ruleAction === 'SUSPEND') {
    return COLORS_V2_ANALYTICS_CHARTS_03;
  }
  if (ruleAction === 'BLOCK') {
    return COLORS_V2_ANALYTICS_CHARTS_02;
  }
  if (ruleAction === 'FLAG') {
    return COLORS_V2_ANALYTICS_CHARTS_04;
  }
  return neverReturn(ruleAction, 'gray');
}

export function getRuleActionColor(ruleAction: RuleAction): string {
  if (ruleAction === 'ALLOW') {
    return COLORS_V2_ALERT_SUCCESS;
  }
  if (ruleAction === 'SUSPEND') {
    return COLORS_V2_RISK_LEVEL_BASE_HIGH;
  }
  if (ruleAction === 'BLOCK') {
    return COLORS.lightRed.base;
  }
  if (ruleAction === 'FLAG') {
    return COLORS_V2_ALERT_WARNING;
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
      return keyBy(rulesResults.data.value, 'id');
    } else {
      return {};
    }
  }, [rulesResults.data]);
  const ruleInstancesMap = useMemo(() => {
    if (ruleInstanceResults.data.kind === 'SUCCESS') {
      return keyBy(ruleInstanceResults.data.value, 'id');
    } else {
      return {};
    }
  }, [ruleInstanceResults.data]);

  return { rules: rulesMap, ruleInstances: ruleInstancesMap };
}

export function useRuleOptions() {
  const rules = useRules();
  return useMemo(() => {
    return Object.values(rules.ruleInstances).map((rulesInstance: RuleInstance) => {
      const ruleName = rulesInstance.ruleNameAlias || rules.rules[rulesInstance.ruleId!]?.name;
      return {
        value: rulesInstance.id ?? '',
        label: [ruleName, rulesInstance.id, rulesInstance.ruleId && `(${rulesInstance.ruleId})`]
          .filter(Boolean)
          .join(' '),
      };
    });
  }, [rules.ruleInstances, rules.rules]);
}

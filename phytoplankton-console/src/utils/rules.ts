import { useMemo } from 'react';
import { keyBy } from 'lodash';
import { useQuery } from './queries/hooks';
import { RULE_INSTANCES, RULES, RULES_WITH_ALERTS } from './queries/keys';
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
import { isLoading } from '@/utils/asyncResource';

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
    case 'REVERSED':
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

interface UseRuleOptionsParams {
  onlyWithAlerts?: boolean;
}

export function useRules(): {
  rules: RulesMap;
  ruleInstances: RuleInstanceMap;
  isLoading: boolean;
} {
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

  return {
    rules: rulesMap,
    ruleInstances: ruleInstancesMap,
    isLoading: isLoading(ruleInstanceResults.data) || isLoading(rulesResults.data),
  };
}

export function useRuleOptions({ onlyWithAlerts = false }: UseRuleOptionsParams = {}) {
  const api = useApi();
  const rules = useRules();

  const { data: rulesWithAlertsData } = useQuery<string[]>(
    RULES_WITH_ALERTS(),
    () => api.getRulesWithAlerts({}),
    {
      enabled: onlyWithAlerts,
    },
  );
  return useMemo(() => {
    let relevantRuleInstances: RuleInstance[] = Object.values(rules.ruleInstances);

    if (onlyWithAlerts && rulesWithAlertsData.kind === 'SUCCESS') {
      const rulesWithAlertsSet = new Set<string>(rulesWithAlertsData.value);
      relevantRuleInstances = relevantRuleInstances.filter((instance) =>
        rulesWithAlertsSet.has(instance.id as string),
      );
    }
    return relevantRuleInstances
      .map((rulesInstance: RuleInstance) => {
        const ruleName =
          rulesInstance.ruleNameAlias ||
          (rulesInstance.ruleId && rules.rules[rulesInstance.ruleId]?.name);

        // Only return an option if ruleName exists; added to fix the issue of rule instances without ruleNameAlias
        if (!ruleName) {
          return null;
        }

        return {
          value: rulesInstance.id ?? '',
          label: [ruleName, rulesInstance.id, rulesInstance.ruleId && `(${rulesInstance.ruleId})`]
            .filter(Boolean)
            .join(' '),
        };
      })
      .filter(Boolean);
  }, [rules.ruleInstances, rules.rules, onlyWithAlerts, rulesWithAlertsData]);
}

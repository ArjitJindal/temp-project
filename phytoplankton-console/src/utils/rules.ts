import { RuleAction, TransactionState } from '@/apis';
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

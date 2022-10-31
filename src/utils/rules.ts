import _ from 'lodash';
import { RuleAction, TransactionState } from '@/apis';
import { neverReturn } from '@/utils/lang';
import COLORS from '@/components/ui/colors';

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

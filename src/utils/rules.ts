import _ from 'lodash';
import { RuleAction, TransactionState } from '@/apis';
import { neverReturn } from '@/utils/lang';

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

export function useRuleActionColor(ruleAction: RuleAction): string {
  if (ruleAction === 'ALLOW') {
    return 'green';
  } else if (ruleAction === 'BLOCK') {
    return 'red';
  } else if (ruleAction === 'FLAG') {
    return 'orange';
  } else if (ruleAction === 'WHITELIST') {
    return 'lime';
  } else {
    return 'yellow';
  }
}

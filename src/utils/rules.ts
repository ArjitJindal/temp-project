import { RuleAction } from '@/apis';
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

export function getRuleActionTitle(ruleAction: RuleAction | string): string {
  if (ruleAction === 'ALLOW') {
    return 'Allowed';
  }
  if (ruleAction === 'FLAG') {
    return 'Flagged';
  }
  if (ruleAction === 'BLOCK') {
    return 'Blocked';
  }
  if (ruleAction === 'WHITELIST') {
    return 'Whitelisted';
  }
  if (ruleAction === 'SUSPEND') {
    return 'Suspended';
  }
  const ruleActionSmall = ruleAction.toLowerCase();
  const ruleActionUse = ruleActionSmall.charAt(0).toUpperCase() + ruleActionSmall.slice(1) + 'ed';
  return ruleActionUse;
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

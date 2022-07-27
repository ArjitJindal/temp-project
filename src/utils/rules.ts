import { RuleAction } from '@/apis';

export function useRuleActionTitle(ruleAction: RuleAction | string): string {
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
  return ruleAction;
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

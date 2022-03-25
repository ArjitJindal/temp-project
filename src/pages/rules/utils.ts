import { RuleAction } from '@/apis/models/RuleAction';

export const RULE_ACTION_OPTIONS = [
  { label: 'Flag', value: RuleAction.Flag },
  { label: 'Block', value: RuleAction.Block },
  { label: 'Whitelist', value: RuleAction.Whitelist },
];

export function getRuleActionColor(ruleAction: RuleAction): string {
  if (ruleAction === RuleAction.Allow) {
    return 'green';
  } else if (ruleAction === RuleAction.Block) {
    return 'red';
  } else if (ruleAction === RuleAction.Flag) {
    return 'orange';
  } else if (ruleAction === RuleAction.Whitelist) {
    return 'lime';
  } else {
    return 'yellow';
  }
}

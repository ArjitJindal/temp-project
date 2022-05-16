import { Badge } from 'antd';
import { RuleAction } from '@/apis';
import { neverReturn } from '@/utils/lang';

function getActionBadgeStatus(ruleAction: RuleAction) {
  if (ruleAction === 'ALLOW' || ruleAction === 'WHITELIST') {
    return 'success';
  } else if (ruleAction === 'FLAG') {
    return 'warning';
  } else if (ruleAction === 'BLOCK') {
    return 'error';
  } else {
    return 'warning';
  }
}

function getActionTitle(ruleAction: RuleAction): string {
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
  return neverReturn(ruleAction, ruleAction);
}

interface Props {
  ruleAction: RuleAction;
}

export const RuleActionStatus: React.FC<Props> = ({ ruleAction }) => {
  return (
    <span>
      <Badge status={getActionBadgeStatus(ruleAction)} />
      {getActionTitle(ruleAction)}
    </span>
  );
};

import { Badge } from 'antd';
import { RuleAction } from '@/apis';

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

interface Props {
  ruleAction: RuleAction;
}

export const RuleActionStatus: React.FC<Props> = ({ ruleAction }) => {
  return (
    <span>
      <Badge status={getActionBadgeStatus(ruleAction)} />
      {ruleAction || 'Unknown'}
    </span>
  );
};

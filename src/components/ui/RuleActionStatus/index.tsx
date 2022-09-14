import { Badge } from 'antd';
import _ from 'lodash';
import { RuleAction } from '@/apis';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { getRuleActionTitle } from '@/utils/rules';

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
  const settings = useSettings();
  const alias = settings.ruleActionAliases?.find((item) => item.action === ruleAction)?.alias;
  return (
    <span>
      <Badge status={getActionBadgeStatus(ruleAction)} />
      {getRuleActionTitle(alias || ruleAction)}
    </span>
  );
};

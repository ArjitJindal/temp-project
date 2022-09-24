import _ from 'lodash';
import cn from 'clsx';
import s from './index.module.less';
import { RuleAction } from '@/apis';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { getRuleActionTitle } from '@/utils/rules';

interface Props {
  ruleAction: RuleAction;
}

export const RuleActionStatus: React.FC<Props> = ({ ruleAction }) => {
  const settings = useSettings();
  const alias = settings.ruleActionAliases?.find((item) => item.action === ruleAction)?.alias;
  return (
    <div className={s.badge}>
      <div className={cn(s.icon, s[`ruleAction-${ruleAction}`])}></div>
      <div>{getRuleActionTitle(alias || ruleAction)}</div>
    </div>
  );
};

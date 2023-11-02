import cn from 'clsx';
import s from './index.module.less';
import { RuleAction } from '@/apis';
import { useRuleActionLabel } from '@/components/AppWrapper/Providers/SettingsProvider';
import { getRuleActionColor, getRuleActionColorForDashboard } from '@/utils/rules';

interface Props {
  ruleAction: RuleAction;
  isForChart?: boolean;
}

export const RuleActionStatus: React.FC<Props> = ({ ruleAction, isForChart = false }) => {
  const ruleActionLabel = useRuleActionLabel(ruleAction);
  return (
    <div className={s.root}>
      <div
        className={cn(s.icon, s[`ruleAction-${ruleAction}`])}
        style={{
          background: isForChart
            ? getRuleActionColorForDashboard(ruleAction)
            : getRuleActionColor(ruleAction),
        }}
      ></div>
      <div>{ruleActionLabel}</div>
    </div>
  );
};

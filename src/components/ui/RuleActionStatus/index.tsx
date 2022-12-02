import _ from 'lodash';
import cn from 'clsx';
import s from './index.module.less';
import { RuleAction } from '@/apis';
import { useRiskActionLabel } from '@/components/AppWrapper/Providers/SettingsProvider';
import { getRuleActionColor } from '@/utils/rules';

interface Props {
  ruleAction: RuleAction;
}

export const RuleActionStatus: React.FC<Props> = ({ ruleAction }) => {
  const ruleActionLabel = useRiskActionLabel(ruleAction);
  return (
    <div className={s.root}>
      <div
        className={cn(s.icon, s[`ruleAction-${ruleAction}`])}
        style={{ background: getRuleActionColor(ruleAction) }}
      ></div>
      <div>{ruleActionLabel}</div>
    </div>
  );
};

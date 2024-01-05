import s from './style.module.less';
import {
  RiskLevelRuleActions,
  RiskLevelRuleLogic,
  RiskLevelsTriggersOnHit,
  RuleAction,
  RuleAggregationVariable,
  TriggersOnHit,
} from '@/apis';

export interface RuleIsHitWhenStepFormValues {
  ruleLogic?: object;
  riskLevelRuleLogic?: RiskLevelRuleLogic;
  ruleLogicAggregationVariables?: RuleAggregationVariable[];
  ruleAction?: RuleAction;
  riskLevelRuleActions?: RiskLevelRuleActions;
  triggersOnHit?: TriggersOnHit;
  riskLevelsTriggersOnHit?: RiskLevelsTriggersOnHit;
}

export const INITIAL_VALUES: RuleIsHitWhenStepFormValues = {};

interface Props {}

export default function RuleIsHitWhenStep(_props: Props) {
  return <div className={s.root}>RuleIsHitWhenStep</div>;
}

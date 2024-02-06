import React from 'react';
import s from './style.module.less';
import {
  CurrencyCode,
  RiskLevelRuleActions,
  RiskLevelRuleLogic,
  RiskLevelsTriggersOnHit,
  RuleAction,
  RuleAggregationVariable,
  TriggersOnHit,
} from '@/apis';
import { useFieldState } from '@/components/library/Form/utils/hooks';
import DefineLogicCard from '@/pages/rules/RuleConfigurationDrawerV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/DefineLogicCard';
import VariableDefinitionCard from '@/pages/rules/RuleConfigurationDrawerV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard';
import { RuleLogic } from '@/pages/rules/RuleConfigurationDrawerV8/RuleConfigurationFormV8/types';

export interface RuleIsHitWhenStepFormValues {
  baseCurrency?: CurrencyCode;
  ruleLogic?: RuleLogic;
  riskLevelRuleLogic?: RiskLevelRuleLogic;
  ruleLogicAggregationVariables?: RuleAggregationVariable[];
  ruleAction?: RuleAction;
  riskLevelRuleActions?: RiskLevelRuleActions;
  triggersOnHit?: TriggersOnHit;
  riskLevelsTriggersOnHit?: RiskLevelsTriggersOnHit;
}

export const INITIAL_VALUES: Partial<RuleIsHitWhenStepFormValues> = {
  triggersOnHit: {
    usersToCheck: 'ALL',
  },
  riskLevelsTriggersOnHit: {
    VERY_LOW: {
      usersToCheck: 'ALL',
    },
    LOW: {
      usersToCheck: 'ALL',
    },
    MEDIUM: {
      usersToCheck: 'ALL',
    },
    HIGH: {
      usersToCheck: 'ALL',
    },
    VERY_HIGH: {
      usersToCheck: 'ALL',
    },
  },
  ruleAction: 'FLAG',
};

export default function RuleIsHitWhenStep() {
  const variablesFieldState = useFieldState<
    RuleIsHitWhenStepFormValues,
    'ruleLogicAggregationVariables'
  >('ruleLogicAggregationVariables');
  const logicFieldState = useFieldState<RuleIsHitWhenStepFormValues, 'ruleLogic'>('ruleLogic');
  const riskLevelsRuleLogicFieldState = useFieldState<
    RuleIsHitWhenStepFormValues,
    'riskLevelRuleLogic'
  >('riskLevelRuleLogic');
  const riskLevelRuleActionsFieldState = useFieldState<
    RuleIsHitWhenStepFormValues,
    'riskLevelRuleActions'
  >('riskLevelRuleActions');
  const baseCurrencyFieldState = useFieldState<RuleIsHitWhenStepFormValues, 'baseCurrency'>(
    'baseCurrency',
  );

  return (
    <div className={s.root}>
      <VariableDefinitionCard
        aggregationVariables={variablesFieldState.value}
        onChange={variablesFieldState.onChange}
      />
      <DefineLogicCard
        variablesFieldState={variablesFieldState}
        riskLevelsLogicFieldState={riskLevelsRuleLogicFieldState}
        riskLevelRuleActionsFieldState={riskLevelRuleActionsFieldState}
        logicFieldState={logicFieldState}
        baseCurrencyFieldState={baseCurrencyFieldState}
      />
    </div>
  );
}

import React from 'react';
import s from './style.module.less';
import {
  CurrencyCode,
  RiskLevelRuleActions,
  RiskLevelRuleLogic,
  RiskLevelsTriggersOnHit,
  RuleAction,
  RuleAggregationVariable,
  RuleEntityVariableInUse,
  RuleMachineLearningVariable,
  RuleType,
  TriggersOnHit,
} from '@/apis';
import { useFieldState } from '@/components/library/Form/utils/hooks';
import DefineLogicCard from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/DefineLogicCard';
import VariableDefinitionCard from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard';
import { RuleLogic } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/types';

export interface RuleIsHitWhenStepFormValues {
  baseCurrency?: CurrencyCode;
  ruleLogic?: RuleLogic;
  riskLevelRuleLogic?: RiskLevelRuleLogic;
  ruleLogicEntityVariables?: RuleEntityVariableInUse[];
  ruleLogicAggregationVariables?: RuleAggregationVariable[];
  ruleLogicMlVariables?: RuleMachineLearningVariable[];
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

export default function RuleIsHitWhenStep(props: { ruleType: RuleType; readOnly?: boolean }) {
  const aggVariablesFieldState = useFieldState<
    RuleIsHitWhenStepFormValues,
    'ruleLogicAggregationVariables'
  >('ruleLogicAggregationVariables');
  const entityVariablesFieldState = useFieldState<
    RuleIsHitWhenStepFormValues,
    'ruleLogicEntityVariables'
  >('ruleLogicEntityVariables');
  const mlVariablesFieldState = useFieldState<RuleIsHitWhenStepFormValues, 'ruleLogicMlVariables'>(
    'ruleLogicMlVariables',
  );
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
        ruleType={props.ruleType}
        readOnly={props.readOnly}
        entityVariables={entityVariablesFieldState.value}
        aggregationVariables={aggVariablesFieldState.value}
        mlVariables={mlVariablesFieldState.value}
        onChange={(v) => {
          if (v.aggregationVariables) {
            aggVariablesFieldState.onChange(v.aggregationVariables);
          }
          if (v.entityVariables) {
            entityVariablesFieldState.onChange(v.entityVariables);
          }
          if (v.mlVariables) {
            mlVariablesFieldState.onChange(v.mlVariables);
          }
        }}
      />
      <DefineLogicCard
        ruleType={props.ruleType}
        entityVariablesFieldState={entityVariablesFieldState}
        aggVariablesFieldState={aggVariablesFieldState}
        riskLevelsLogicFieldState={riskLevelsRuleLogicFieldState}
        riskLevelRuleActionsFieldState={riskLevelRuleActionsFieldState}
        logicFieldState={logicFieldState}
        baseCurrencyFieldState={baseCurrencyFieldState}
        mlVariableFieldState={mlVariablesFieldState}
      />
    </div>
  );
}

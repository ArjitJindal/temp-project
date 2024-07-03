import React from 'react';
import s from './style.module.less';
import { LogicDefinationCard } from './LogicDefinationCard';
import {
  CurrencyCode,
  RiskParameterLevelKeyValueV8,
  RuleAggregationVariable,
  RuleEntityVariableEntityEnum,
  RuleEntityVariableInUse,
  RuleType,
} from '@/apis';
import { useFieldState } from '@/components/library/Form/utils/hooks';
import VariableDefinitionCard from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard';

export interface RiskFactorConfigurationStepFormValues {
  baseCurrency?: CurrencyCode;
  riskLevelAssignmentValues?: Array<RiskParameterLevelKeyValueV8>;
  entityVariables?: RuleEntityVariableInUse[];
  aggregationVariables?: RuleAggregationVariable[];
}

interface Props {
  ruleType: RuleType;
  readOnly?: boolean;
  entity?: RuleEntityVariableEntityEnum;
}
export default function RiskFactorConfigurationStep(props: Props) {
  const aggVariablesFieldState = useFieldState<
    RiskFactorConfigurationStepFormValues,
    'aggregationVariables'
  >('aggregationVariables');
  const entityVariablesFieldState = useFieldState<
    RiskFactorConfigurationStepFormValues,
    'entityVariables'
  >('entityVariables');
  const riskLevelAssignmentValues = useFieldState<
    RiskFactorConfigurationStepFormValues,
    'riskLevelAssignmentValues'
  >('riskLevelAssignmentValues');

  const baseCurrencyFieldState = useFieldState<
    RiskFactorConfigurationStepFormValues,
    'baseCurrency'
  >('baseCurrency');
  return (
    <div className={s.root}>
      <VariableDefinitionCard
        ruleType={props.ruleType}
        readOnly={props.readOnly}
        entityVariables={entityVariablesFieldState.value}
        aggregationVariables={aggVariablesFieldState.value}
        onChange={(v) => {
          if (v.aggregationVariables) {
            aggVariablesFieldState.onChange(v.aggregationVariables);
          }
          if (v.entityVariables) {
            entityVariablesFieldState.onChange(v.entityVariables);
          }
        }}
        entity={props.entity}
      />
      <LogicDefinationCard
        ruleType={props.ruleType}
        entityVariablesFieldState={entityVariablesFieldState}
        aggVariablesFieldState={aggVariablesFieldState}
        riskLevelAssignmentValues={riskLevelAssignmentValues}
        baseCurrencyFieldState={baseCurrencyFieldState}
      />
    </div>
  );
}

import React from 'react';
import s from './style.module.less';
import { LogicDefinitionCard } from './LogicDefinitionCard';
import {
  CurrencyCode,
  LogicAggregationVariable,
  LogicEntityVariableEntityEnum,
  LogicEntityVariableInUse,
  RuleType,
  RiskLevelRiskFactorLogic,
} from '@/apis';
import { useFieldState } from '@/components/library/Form/utils/hooks';
import VariableDefinitionCard from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard';

export interface RiskFactorConfigurationStepFormValues {
  baseCurrency?: CurrencyCode;
  riskLevelLogic?: RiskLevelRiskFactorLogic;
  entityVariables?: LogicEntityVariableInUse[];
  aggregationVariables?: LogicAggregationVariable[];
}

interface Props {
  ruleType: RuleType;
  readOnly?: boolean;
  entity?: LogicEntityVariableEntityEnum;
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
  const riskLevelLogic = useFieldState<RiskFactorConfigurationStepFormValues, 'riskLevelLogic'>(
    'riskLevelLogic',
  );

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
      <LogicDefinitionCard
        ruleType={props.ruleType}
        entityVariablesFieldState={entityVariablesFieldState}
        aggVariablesFieldState={aggVariablesFieldState}
        riskLevelLogic={riskLevelLogic}
        baseCurrencyFieldState={baseCurrencyFieldState}
      />
    </div>
  );
}

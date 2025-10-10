import React, { forwardRef } from 'react';
import s from './style.module.less';
import { LogicDefinitionCard } from './LogicDefinitionCard';
import {
  CurrencyCode,
  LogicAggregationVariable,
  LogicEntityVariableEntityEnum,
  LogicEntityVariableInUse,
  RiskFactor,
  RiskFactorDataType as DataType,
  RiskFactorLogic,
  RiskFactorParameter,
  RuleType,
} from '@/apis';
import { useFieldState } from '@/components/library/Form/utils/hooks';
import VariableDefinitionCard from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard';
import { DEFAULT_RISK_LEVEL } from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/RiskFactorConfigurationForm/RiskFactorConfigurationStep/ParametersTable/const';

export interface RiskFactorConfigurationStepFormValues {
  baseCurrency?: CurrencyCode;
  riskLevelLogic?: RiskFactorLogic[];
  entityVariables?: LogicEntityVariableInUse[];
  aggregationVariables?: LogicAggregationVariable[];
}

interface Props {
  ruleType: RuleType;
  readOnly?: boolean;
  entity?: LogicEntityVariableEntityEnum;
}

const RiskFactorConfigurationStep = forwardRef((props: Props) => {
  const aggVariablesFieldState = useFieldState<any, 'aggregationVariables'>('aggregationVariables');
  const entityVariablesFieldState = useFieldState<any, 'entityVariables'>('entityVariables');
  const riskLevelLogic = useFieldState<any, 'riskLevelLogic'>('riskLevelLogic');
  const baseCurrencyFieldState = useFieldState<any, 'baseCurrency'>('baseCurrency');

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
        readOnly={props.readOnly}
        entityVariablesFieldState={entityVariablesFieldState}
        aggVariablesFieldState={aggVariablesFieldState}
        riskLevelLogic={riskLevelLogic}
        baseCurrencyFieldState={baseCurrencyFieldState}
      />
    </div>
  );
});

export const convertRiskFactorToRiskLevelTableItem = (item: RiskFactor): any => {
  return {
    parameter: item.parameter as RiskFactorParameter,
    title: item.name,
    description: item.description,
    entity: item.type,
    dataType: item.dataType as DataType,
    isDerived: item.isDerived ?? false,
    parameterType: 'VARIABLE',
    defaultValue: {
      type: 'RISK_LEVEL',
      value: item.defaultRiskLevel ?? DEFAULT_RISK_LEVEL,
    },
    weight: item.defaultWeight,
  };
};

export default RiskFactorConfigurationStep;

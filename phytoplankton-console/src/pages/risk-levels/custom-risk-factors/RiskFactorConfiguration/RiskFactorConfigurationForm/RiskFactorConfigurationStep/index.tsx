import React, { forwardRef } from 'react';
import s from './style.module.less';
import { LogicDefinitionCard } from './LogicDefinitionCard';
import ParametersTable from './ParametersTable';
import {
  CurrencyCode,
  LogicAggregationVariable,
  LogicEntityVariableEntityEnum,
  LogicEntityVariableInUse,
  RuleType,
  RiskFactorLogic,
  RiskFactor,
  RiskFactorParameter,
  RiskFactorDataType as DataType,
  RiskEntityType,
  RiskScoreValueScore,
  RiskScoreValueLevel,
} from '@/apis';
import { useFieldState } from '@/components/library/Form/utils/hooks';
import VariableDefinitionCard from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard';
import { DEFAULT_RISK_LEVEL } from '@/pages/risk-levels/risk-factors/ParametersTable/consts';
import { ParameterValues } from '@/pages/risk-levels/risk-factors/ParametersTable/types';
import * as Card from '@/components/ui/Card';

export interface RiskFactorConfigurationStepFormValues {
  baseCurrency?: CurrencyCode;
  riskLevelLogic?: RiskFactorLogic[];
  entityVariables?: LogicEntityVariableInUse[];
  aggregationVariables?: LogicAggregationVariable[];
}
interface V2Props {
  item: RiskFactor;
  parameter: RiskFactorParameter;
}
interface LiftedParameters {
  parameter: RiskFactorParameter;
  values: ParameterValues;
  setValues: (values: ParameterValues) => void;
  entity: RiskEntityType;
  defaultRiskValue: RiskScoreValueLevel | RiskScoreValueScore;
  weight: number;
  setDefaultRiskValue: (value: RiskScoreValueLevel | RiskScoreValueScore) => void;
  setWeight: (value: number) => void;
  onSave: () => void;
}
interface Props {
  ruleType: RuleType;
  readOnly?: boolean;
  entity?: LogicEntityVariableEntityEnum;
  v2Props?: V2Props;
  liftedParameters?: LiftedParameters;
}
const RiskFactorConfigurationStep = forwardRef((props: Props) => {
  const aggVariablesFieldState = useFieldState<any, 'aggregationVariables'>('aggregationVariables');
  const entityVariablesFieldState = useFieldState<any, 'entityVariables'>('entityVariables');
  const riskLevelLogic = useFieldState<any, 'riskLevelLogic'>('riskLevelLogic');
  const baseCurrencyFieldState = useFieldState<any, 'baseCurrency'>('baseCurrency');

  if (!props.v2Props) {
    return (
      <>
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
      </>
    );
  }

  return (
    <div className={s.root}>
      <Card.Root>
        <Card.Section>
          {props.liftedParameters && (
            <ParametersTable
              parameter={convertRiskFactorToRiskLevelTableItem(props.v2Props.item)}
              values={props.liftedParameters.values}
              setValues={props.liftedParameters.setValues}
              entity={props.liftedParameters.entity as RiskEntityType}
              defaultRiskValue={props.liftedParameters.defaultRiskValue}
              weight={props.liftedParameters.weight}
              setDefaultRiskValue={props.liftedParameters.setDefaultRiskValue}
              setWeight={props.liftedParameters.setWeight}
              onSave={props.liftedParameters.onSave}
              canEditParameters={true}
            />
          )}
        </Card.Section>
      </Card.Root>
    </div>
  );
});

const convertRiskFactorToRiskLevelTableItem = (item: RiskFactor): any => {
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

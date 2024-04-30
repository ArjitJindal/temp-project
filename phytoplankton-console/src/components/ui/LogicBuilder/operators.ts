import { BasicConfig, Config, CoreOperators, Operator } from '@react-awesome-query-builder/ui';
import { omit } from 'lodash';
import { RuleOperator } from '@/apis';

export const isCustomOperator = (operatorKey?: string): boolean => {
  return operatorKey?.startsWith('op:') ?? false;
};

export function getOperatorsByValueType(
  operators: RuleOperator[],
  valueType: string,
): RuleOperator[] {
  return operators.filter((v) => v.uiDefinition.valueTypes?.includes(valueType));
}

const BUILT_IN_OPERATORS = omit(BasicConfig.operators, [
  'starts_with',
  'ends_with',
  'proximity',
  'like',
  'not_like',
  'multi_select_contains',
  'multi_select_not_contains',
]) as CoreOperators<Config>;

export const JSON_LOGIC_OPERATORS: CoreOperators<Config> = {
  ...BUILT_IN_OPERATORS,
  select_any_in: {
    ...BasicConfig.operators.select_any_in,
    valueTypes: ['multiselect', 'text'],
  },
  select_not_any_in: {
    ...BasicConfig.operators.select_not_any_in,
    valueTypes: ['multiselect', 'text'],
  },
};

export function getOperatorWithParameter(operator: RuleOperator): RuleOperator {
  const { key, parameters } = operator;
  const uiDefinition: Operator<Config> = {
    ...operator.uiDefinition,
    jsonLogic: key,
    cardinality: (operator.uiDefinition.cardinality ?? 1) + (parameters ? 1 : 0),
    parameters,
  };
  return {
    ...operator,
    uiDefinition,
  };
}

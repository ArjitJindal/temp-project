import { BasicConfig, Config, CoreOperators, Operator } from '@react-awesome-query-builder/ui';
import { omit } from 'lodash';
import { LogicOperator, LogicOperatorType } from '@/apis';

export const isCustomOperator = (operatorKey?: string): boolean => {
  return operatorKey?.startsWith('op:') ?? false;
};

export function getOperatorsByValueType(
  operators: LogicOperator[],
  valueType: string,
): LogicOperator[] {
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
BUILT_IN_OPERATORS.equal.label = '=';
BUILT_IN_OPERATORS.not_equal.label = '≠';
BUILT_IN_OPERATORS.greater_or_equal.label = '≥';
BUILT_IN_OPERATORS.less_or_equal.label = '≤';

export const MULTI_SELECT_LIST_OPERATORS: LogicOperatorType[] = ['op:inlist', 'op:!inlist'];
export const REGEX_MATCH_OPERATORS: LogicOperatorType[] = ['op:regexmatch', 'op:!regexmatch'];
export const MULTI_SELECT_BUILTIN_OPERATORS: string[] = ['select_any_in', 'select_not_any_in'];
export const SELECT_OPERATORS: Array<keyof CoreOperators> = [
  'equal',
  'not_equal',
  'select_any_in',
  'select_not_any_in',
  'is_null',
  'is_not_null',
];

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

export function getOperatorWithParameter(operator: LogicOperator): LogicOperator {
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

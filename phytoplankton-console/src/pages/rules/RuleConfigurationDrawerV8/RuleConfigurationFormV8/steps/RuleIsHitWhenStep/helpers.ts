import pluralize from 'pluralize';
import { lowerCase } from 'lodash';
import { Config, BasicConfig } from '@react-awesome-query-builder/ui';
import { useState, useEffect } from 'react';
import { humanizeAuto } from '@/utils/humanize';
import { AsyncResource, init, map } from '@/utils/asyncResource';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { RULE_LOGIC_CONFIG } from '@/utils/queries/keys';
import { useIsChanged } from '@/utils/hooks';
import { makeConfig } from '@/components/ui/LogicBuilder/helpers';
import {
  RuleAggregationFunc,
  RuleAggregationVariable,
  RuleEntityVariable,
  RuleLogicConfig,
  RuleOperator,
} from '@/apis';

function getSupportedOperatorsKeys(operators: RuleOperator[], valueType: string): string[] {
  return operators.filter((v) => v.uiDefinition.valueTypes?.includes(valueType)).map((v) => v.key);
}

export function useLogicBuilderConfig(
  entityVariableTypes: Array<
    'TRANSACTION' | 'CONSUMER_USER' | 'BUSINESS_USER' | 'USER' | 'PAYMENT_DETAILS'
  >,
  aggregationVariables: RuleAggregationVariable[],
): AsyncResource<Config> {
  const [result, setResult] = useState<AsyncResource<Config>>(init());
  const api = useApi();
  const ruleLogicConfigResult = useQuery<RuleLogicConfig>(
    RULE_LOGIC_CONFIG(),
    (): Promise<RuleLogicConfig> => api.getRuleLogicConfig(),
  );
  const ruleLogicConfigRes = ruleLogicConfigResult.data;

  const variablesChanged = useIsChanged(aggregationVariables);
  const configResChanged = useIsChanged(ruleLogicConfigRes);
  useEffect(() => {
    if (!(configResChanged || variablesChanged)) {
      return;
    }
    setResult(
      map(ruleLogicConfigRes, (ruleLogicConfig): Config => {
        const {
          variables: entityVariables = [],
          functions = [],
          operators = [],
        } = ruleLogicConfig ?? {};
        const aggregationVariablesGrouped = aggregationVariables.map((v) => {
          const definition = getAggVarDefinition(v, entityVariables ?? []);
          if (v.name) {
            definition.uiDefinition.label = v.name;
          }
          return definition;
        });
        const filteredEntityVariables = entityVariables.filter((v) =>
          entityVariableTypes.includes(v.entity!),
        );
        const variables = filteredEntityVariables.concat(aggregationVariablesGrouped);
        const types = InitialConfig.types;
        for (const key in types) {
          if (types[key].widgets[key]) {
            const initialOperators = types[key].widgets[key].operators ?? [];
            types[key].widgets[key].operators = initialOperators.concat(
              getSupportedOperatorsKeys(operators, key),
            );
            if (key === 'select') {
              types[key].widgets['multiselect'].operators = [
                ...(types[key].widgets['multiselect'].operators ?? []),
                ...getSupportedOperatorsKeys(operators, 'multiselect'),
              ];
            } else if (key === 'text') {
              types[key].widgets[key].operators = [
                ...(types[key].widgets[key].operators ?? []),
                'select_any_in',
                'select_not_any_in',
              ];
            }
          }
        }

        const config = makeConfig({
          types,
          operators: {
            ...Object.fromEntries(operators.map((v) => [v.key, v.uiDefinition])),
          },
          funcs: {
            ...Object.fromEntries(functions.map((v) => [v.key, v.uiDefinition])),
          },
          fields: {
            ...Object.fromEntries(variables.map((v) => [v.key, v.uiDefinition])),
          },
        });
        return config;
      }),
    );
  }, [
    ruleLogicConfigRes,
    variablesChanged,
    aggregationVariables,
    result,
    configResChanged,
    entityVariableTypes,
  ]);

  return result;
}

const InitialConfig = BasicConfig;
const AGG_FUNC_TO_TYPE: Record<RuleAggregationFunc, string> = {
  AVG: 'number',
  COUNT: 'number',
  SUM: 'number',
};

function getAggVarDefinition(
  aggVar: RuleAggregationVariable,
  entityVariables: RuleEntityVariable[],
) {
  const entityVariable = entityVariables.find((v) => v.key === aggVar.aggregationFieldKey);
  const { start, end } = aggVar.timeWindow;
  const startLabel = `${start.units} ${pluralize(lowerCase(start.granularity), start.units)} ago`;
  const endLabel =
    end.units === 0 ? '' : `${end.units} ${pluralize(lowerCase(end.granularity), end.units)} ago`;
  const timeWindowLabel = `${startLabel}${endLabel ? ` - ${endLabel}` : ''}`;
  const entityVariableLabel =
    entityVariable &&
    (aggVar.aggregationFunc === 'COUNT'
      ? lowerCase(pluralize(entityVariable.entity!))
      : entityVariable?.uiDefinition?.label);
  const label = `${humanizeAuto(aggVar.aggregationFunc)} of ${
    entityVariableLabel ?? aggVar.aggregationFieldKey
  } (${timeWindowLabel})`;
  return {
    key: aggVar.key,
    uiDefinition: {
      label,
      type: AGG_FUNC_TO_TYPE[aggVar.aggregationFunc],
      valueSources: ['value', 'field', 'func'],
    },
  };
}

export function isTransactionAmountVariable(variableKey: string): boolean {
  return variableKey?.endsWith('transactionAmount');
}

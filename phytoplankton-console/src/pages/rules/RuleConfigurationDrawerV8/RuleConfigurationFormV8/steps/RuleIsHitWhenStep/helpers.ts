import { Config, BasicConfig } from '@react-awesome-query-builder/ui';
import { useState, useEffect } from 'react';
import { AsyncResource, init, map } from '@/utils/asyncResource';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { RULE_LOGIC_CONFIG } from '@/utils/queries/keys';
import { useIsChanged } from '@/utils/hooks';
import { makeConfig } from '@/components/ui/LogicBuilder/helpers';
import { RuleAggregationVariable, RuleLogicConfig, RuleOperator } from '@/apis';
import { LogicBuilderConfig } from '@/components/ui/LogicBuilder/types';
import { getAggVarDefinition } from '@/pages/rules/RuleConfigurationDrawer/steps/RuleParametersStep/utils';

const InitialConfig = BasicConfig;

function getSupportedOperatorsKeys(operators: RuleOperator[], valueType: string): string[] {
  return operators.filter((v) => v.uiDefinition.valueTypes?.includes(valueType)).map((v) => v.key);
}

export function useLogicBuilderConfig(
  entityVariableTypes: Array<
    'TRANSACTION' | 'CONSUMER_USER' | 'BUSINESS_USER' | 'USER' | 'PAYMENT_DETAILS'
  >,
  aggregationVariables: RuleAggregationVariable[],
  configParams: Partial<LogicBuilderConfig>,
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
          ...configParams,
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
    configParams,
  ]);

  return result;
}

export function isTransactionAmountVariable(variableKey: string): boolean {
  return variableKey?.endsWith('transactionAmount');
}

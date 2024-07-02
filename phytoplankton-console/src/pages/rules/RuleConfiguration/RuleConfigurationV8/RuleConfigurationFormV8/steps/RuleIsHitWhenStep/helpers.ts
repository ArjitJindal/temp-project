import { Config, BasicConfig } from '@react-awesome-query-builder/ui';
import { useState, useEffect, useMemo } from 'react';
import { compact } from 'lodash';
import { AsyncResource, init, isSuccess, map } from '@/utils/asyncResource';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { RULE_LOGIC_CONFIG } from '@/utils/queries/keys';
import { useIsChanged } from '@/utils/hooks';
import { makeConfig } from '@/components/ui/LogicBuilder/helpers';
import {
  RuleAggregationVariable,
  RuleEntityVariableEntityEnum,
  RuleEntityVariableInUse,
  RuleLogicConfig,
  RuleType,
} from '@/apis';
import { LogicBuilderConfig } from '@/components/ui/LogicBuilder/types';
import { getAggVarDefinition } from '@/pages/rules/RuleConfiguration/RuleConfigurationV2/steps/RuleParametersStep/utils';
import {
  getOperatorWithParameter,
  getOperatorsByValueType,
} from '@/components/ui/LogicBuilder/operators';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { JSON_LOGIC_FUNCTIONS } from '@/components/ui/LogicBuilder/functions';

const InitialConfig = BasicConfig;

export function useRuleLogicConfig(ruleType: RuleType) {
  const v8Enabled = useFeatureEnabled('RULES_ENGINE_V8');
  const api = useApi();
  const settings = useSettings();

  const queryResult = useQuery<RuleLogicConfig>(
    RULE_LOGIC_CONFIG(),
    async (): Promise<RuleLogicConfig> => {
      const response = await api.getRuleLogicConfig();
      if (response.ruleLogicConfig) {
        return response.ruleLogicConfig;
      }

      const ruleLogicConfig = (await fetch(response.s3Url).then((res) =>
        res.json(),
      )) as RuleLogicConfig;
      return ruleLogicConfig;
    },
    { refetchOnMount: false, enabled: v8Enabled },
  );

  return useMemo(() => {
    if (isSuccess(queryResult.data)) {
      const variables = queryResult.data.value.variables
        .filter(
          (v) =>
            !v?.requiredFeatures?.length ||
            v.requiredFeatures.every((f) => settings.features?.includes(f)),
        )
        .map((v) => {
          if (ruleType !== 'TRANSACTION') {
            return v;
          }
          if (v.entity === 'TRANSACTION') {
            return v;
          }
          let label = v.uiDefinition.label;
          if (isUserSenderVariable(v.key)) {
            label += ' (sender)';
          } else if (isUserReceiverVariable(v.key)) {
            label += ' (receiver)';
          } else if (isUserSenderOrReceiverVariable(v.key)) {
            label += ' (sender or receiver)';
          }
          return {
            ...v,
            uiDefinition: {
              ...v.uiDefinition,
              label,
            },
          };
        });
      return {
        ...queryResult,
        data: {
          ...queryResult.data,
          value: {
            ...queryResult.data.value,
            variables,
          },
        },
      };
    }
    return queryResult;
  }, [queryResult, ruleType, settings.features]);
}

export function useLogicBuilderConfig(
  ruleType: RuleType,
  entityVariableTypes: RuleEntityVariableEntityEnum[],
  entityVariablesInUse: RuleEntityVariableInUse[] | undefined,
  aggregationVariables: RuleAggregationVariable[],
  configParams: Partial<LogicBuilderConfig>,
): AsyncResource<Config> {
  const [result, setResult] = useState<AsyncResource<Config>>(init());
  const ruleLogicConfigResult = useRuleLogicConfig(ruleType);
  const ruleLogicConfigRes = ruleLogicConfigResult.data;

  const variablesChanged = useIsChanged([...aggregationVariables, ...(entityVariablesInUse ?? [])]);
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
        const filteredEntityVariables = entityVariablesInUse
          ? compact(
              entityVariablesInUse.map((v) => {
                const entityVariable = entityVariables.find((e) => e.key === v.entityKey);
                if (!entityVariable) {
                  return;
                }
                return {
                  ...entityVariable,
                  uiDefinition: {
                    ...entityVariable.uiDefinition,
                    label: v.name || entityVariable.uiDefinition.label,
                  },
                  key: v.key,
                };
              }),
            )
          : entityVariables;
        const finalEntityVariables = filteredEntityVariables.filter(
          (v) => v.entity != null && entityVariableTypes.includes(v.entity),
        );
        const variables = finalEntityVariables.concat(aggregationVariablesGrouped);
        const types = InitialConfig.types;
        for (const key in types) {
          if (types[key].widgets[key]) {
            const initialOperators = types[key].widgets[key].operators ?? [];
            types[key].widgets[key].operators = initialOperators.concat(
              getOperatorsByValueType(operators, key).map((v) => v.key),
            );
            if (key === 'number') {
              types[key].widgets = {
                ...types[key].widgets,
                slider: {
                  operators: [
                    'equal',
                    'not_equal',
                    'greater',
                    'greater_or_equal',
                    'less',
                    'less_or_equal',
                    'between',
                    'not_between',
                  ],
                },
              };
            }
            if (key === 'select') {
              types[key].widgets['multiselect'].operators = [
                ...(types[key].widgets['multiselect'].operators ?? []),
                ...getOperatorsByValueType(operators, 'multiselect').map((v) => v.key),
              ];
            } else if (key === 'text') {
              types[key].widgets[key].operators = [
                ...(types[key].widgets[key].operators ?? []),
                'select_any_in',
                'select_not_any_in',
              ];
              types[key].widgets['field'].operators = [
                ...(types[key].widgets['field'].operators ?? []),
                // Allow text variable to be used in the RHS
                ...getOperatorsByValueType(operators, 'text').map((v) => v.key),

                'select_any_in',
                'select_not_any_in',
              ];
            } else if (key === 'time') {
              types[key].widgets[key].operators = types[key].widgets[key].operators?.filter(
                (op) => !['between', 'not_between'].includes(op),
              );
            }
          }
        }

        const operatorsWithParameters = operators
          .filter((op) => op.uiDefinition)
          .map(getOperatorWithParameter);
        const operatorsWithoutParameters = operators.filter((op) => !op.parameters);

        // TODO: Support option gruops and uncomment below
        // const funcionGroups = groupBy(functions.concat(JSON_LOGIC_FUNCTIONS), (v) => v.group);
        // const funcs = mapValues(
        //   funcionGroups,
        //   (value, key) =>
        //     ({
        //       type: '!struct',
        //       label: humanizeAuto(key),
        //       subfields: Object.fromEntries(value.map((f) => [f.key, f.uiDefinition])),
        //     } as FuncGroup),
        // );
        const config = makeConfig({
          ...configParams,
          types,
          operators: {
            ...Object.fromEntries(
              operatorsWithParameters
                .concat(operatorsWithoutParameters)
                .map((v) => [v.key, v.uiDefinition]),
            ),
          },
          funcs: {
            ...Object.fromEntries(
              functions.concat(JSON_LOGIC_FUNCTIONS).map((v) => [v.key, v.uiDefinition]),
            ),
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
    entityVariablesInUse,
  ]);

  return result;
}

export function isTransactionAmountVariable(variableKey: string): boolean {
  return variableKey?.includes('transactionAmount');
}

export function isTransactionOriginVariable(variableKey: string) {
  return variableKey.startsWith('TRANSACTION:origin');
}
export function isTransactionDestinationVariable(variableKey: string) {
  return variableKey.startsWith('TRANSACTION:destination');
}
export function isTransactionOriginOrDestinationVariable(variableKey: string) {
  return variableKey.endsWith('__BOTH');
}
export function isUserSenderVariable(variableKey: string) {
  return variableKey.endsWith('__SENDER');
}
export function isUserReceiverVariable(variableKey: string) {
  return variableKey.endsWith('__RECEIVER');
}
export function isUserSenderOrReceiverVariable(variableKey: string) {
  return variableKey.endsWith('__BOTH');
}

import { BasicConfig, Settings } from '@react-awesome-query-builder/ui';
import { useEffect, useMemo, useState } from 'react';
import { compact, sortBy, uniq } from 'lodash';
import { AsyncResource, all, init, map } from '@/utils/asyncResource';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { RULE_LOGIC_CONFIG } from '@/utils/queries/keys';
import { useIsChanged } from '@/utils/hooks';
import { makeConfig } from '@/components/ui/LogicBuilder/helpers';
import {
  LogicAggregationVariable,
  LogicConfig,
  LogicEntityVariable,
  LogicEntityVariableEntityEnum,
  LogicEntityVariableInUse,
  RuleMachineLearningVariable,
  RuleType,
} from '@/apis';
import { LogicBuilderConfig, QueryBuilderConfig } from '@/components/ui/LogicBuilder/types';
import { getAggVarDefinition } from '@/pages/rules/RuleConfiguration/RuleConfigurationV2/steps/RuleParametersStep/utils';
import {
  getOperatorsByValueType,
  getOperatorWithParameter,
} from '@/components/ui/LogicBuilder/operators';
import {
  getRiskLevelLabel,
  useFeatureEnabled,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { JSON_LOGIC_FUNCTIONS } from '@/components/ui/LogicBuilder/functions';

const InitialConfig = BasicConfig;

function useLogicConfigRes(
  ruleType: RuleType,
  params: {
    excludeSelectOptions?: boolean;
    filterVarNames?: string[];
  },
): AsyncResource<LogicConfig> {
  const v8Enabled = useFeatureEnabled('RULES_ENGINE_V8');
  const api = useApi();
  const settings = useSettings();

  const queryResult = useQuery<LogicConfig>(
    RULE_LOGIC_CONFIG(params),
    async (): Promise<LogicConfig> => {
      const response = await api.getLogicConfig({
        LogicConfigRequest: {
          excludeSelectOptions: params.excludeSelectOptions,
          filterVarNames: params.filterVarNames,
        },
      });
      if (!response.logicConfig) {
        throw new Error('No logic config found');
      }
      return response.logicConfig;
    },
    { refetchOnMount: false, enabled: v8Enabled, staleTime: Infinity },
  );

  return useMemo(() => {
    return map(queryResult.data, (value) => {
      const variables = value.variables
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
          if (label.includes('risk level')) {
            if (v.uiDefinition.fieldSettings?.listValues) {
              v.uiDefinition.fieldSettings.listValues = v.uiDefinition.fieldSettings.listValues.map(
                (item: any) => ({
                  ...item,
                  title: getRiskLevelLabel(item.value, settings).riskLevelLabel,
                }),
              );
            }
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
        ...value,
        variables,
      };
    });
  }, [queryResult.data, ruleType, settings]);
}

/**
 * Get the list of entity variables for the rule type, without details. Required since the whole config is too big to transfer.
 *
 * @param ruleType
 * @returns
 */
export function useLogicEntityVariablesList(
  ruleType: RuleType,
): AsyncResource<LogicEntityVariable[]> {
  const ruleLogicConfig = useLogicConfigBrief(ruleType);
  return map(ruleLogicConfig, (value) => value.variables);
}

/**
 * Get the config, including all variables, but without details.  Required since the whole config is too big to transfer.
 *
 * @param ruleType
 * @returns
 */
export function useLogicConfigBrief(ruleType: RuleType): AsyncResource<LogicConfig> {
  const ruleLogicConfig = useLogicConfigRes(ruleType, {
    excludeSelectOptions: true,
  });
  return ruleLogicConfig;
}

/**
 * Get the config, including only the variables with the given names.  Required since the whole config is too big to transfer.
 *
 * @param ruleType
 * @returns
 */
export function useLogicConfigDetailed(
  ruleType: RuleType,
  varNames: string[],
): AsyncResource<LogicConfig> {
  const ruleLogicConfig = useLogicConfigRes(ruleType, {
    excludeSelectOptions: false,
    filterVarNames: sortBy(uniq(varNames)),
  });
  return ruleLogicConfig;
}

export function useRuleLogicBuilderConfig(
  ruleType: RuleType,
  entityVariableTypes: LogicEntityVariableEntityEnum[] | undefined,
  entityVariablesToShow: LogicEntityVariableInUse[] | undefined,
  entityVariablesInUse: string[] | undefined,
  aggregationVariables: LogicAggregationVariable[],
  configParams: Partial<LogicBuilderConfig>,
  mlVariables: RuleMachineLearningVariable[],
  settings?: Partial<Settings>,
): AsyncResource<QueryBuilderConfig> {
  const [result, setResult] = useState<AsyncResource<QueryBuilderConfig>>(init());

  const ruleLogicConfigBriefRes = useLogicConfigBrief(ruleType);

  const ruleLogicConfigDetailedRes = useLogicConfigDetailed(ruleType, entityVariablesInUse ?? []);

  const ruleLogicConfigsRes = all([ruleLogicConfigBriefRes, ruleLogicConfigDetailedRes]);

  const variablesChanged = useIsChanged([
    ...aggregationVariables,
    ...mlVariables,
    ...(entityVariablesToShow ?? []),
  ]);
  const configResChanged = useIsChanged(ruleLogicConfigsRes);
  const isVarsTypeChanged = useIsChanged(entityVariableTypes);
  useEffect(() => {
    if (!(configResChanged || variablesChanged || isVarsTypeChanged)) {
      return;
    }
    setResult(
      map(
        ruleLogicConfigsRes,
        ([ruleLogicConfigBrief, ruleLogicConfigDetailed]): QueryBuilderConfig => {
          const { variables: detailedVariables = [] } = ruleLogicConfigDetailed ?? {};

          const {
            variables: entityVariablesBrief = [],
            functions = [],
            operators = [],
          } = ruleLogicConfigBrief ?? {};

          const entityVariables = entityVariablesBrief.map((v) => {
            const detailedVariable = detailedVariables.find((dv) => dv.key === v.key);
            if (detailedVariable) {
              return detailedVariable;
            }
            return v;
          });

          const aggregationVariablesGrouped = aggregationVariables.map((v) => {
            const definition = getAggVarDefinition(v, entityVariables ?? []);
            if (v.name) {
              definition.uiDefinition.label = v.name;
            }
            return {
              ...definition,
              uiDefinition: {
                ...definition.uiDefinition,
                fieldName: v.key,
              },
            };
          });
          const filteredEntityVariables = entityVariablesToShow
            ? compact(
                entityVariablesToShow.map((v) => {
                  const entityVariable = entityVariables.find((e) => e.key === v.entityKey);
                  if (!entityVariable) {
                    return;
                  }
                  return {
                    ...entityVariable,
                    uiDefinition: {
                      ...entityVariable.uiDefinition,
                      fieldName: v.key,
                      label: v.name || entityVariable.uiDefinition.label,
                    },
                    key: v.key,
                  };
                }),
              )
            : entityVariables;
          const finalEntityVariables = filteredEntityVariables.filter(
            (v) =>
              v.entity != null &&
              (entityVariableTypes == null || entityVariableTypes.includes(v.entity)),
          );
          const finalMlVariables = mlVariables.map((v) => {
            return {
              key: v.key,
              valueType: v.valueType ?? 'number',
              uiDefinition: {
                label: v.name,
                type: 'number',
                valueSources: ['value', 'func'],
              },
            };
          });
          const variables = finalEntityVariables.concat(
            aggregationVariablesGrouped,
            finalMlVariables,
          );

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
          const config = makeConfig(
            {
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
            },
            settings,
          );

          return config;
        },
      ),
    );
  }, [
    ruleLogicConfigsRes,
    variablesChanged,
    aggregationVariables,
    result,
    configResChanged,
    entityVariableTypes,
    configParams,
    entityVariablesToShow,
    mlVariables,
    settings,
    isVarsTypeChanged,
  ]);
  return result;
}

export function isTransactionAmountVariable(variableKey: string): boolean {
  return variableKey?.includes('transactionAmount') || variableKey?.includes('amountValue');
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
export function isDirectionlessVariable(variableKey: string): boolean {
  if (variableKey.startsWith('TRANSACTION:')) {
    return (
      !variableKey.startsWith('TRANSACTION:origin') &&
      !variableKey.startsWith('TRANSACTION:destination') &&
      !variableKey.endsWith('__BOTH')
    );
  }

  return (
    !variableKey.endsWith('__SENDER') &&
    !variableKey.endsWith('__RECEIVER') &&
    !variableKey.endsWith('__BOTH')
  );
}

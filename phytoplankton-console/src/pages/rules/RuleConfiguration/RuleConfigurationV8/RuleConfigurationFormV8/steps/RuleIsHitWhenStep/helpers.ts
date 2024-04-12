import { Config, BasicConfig } from '@react-awesome-query-builder/ui';
import { useState, useEffect } from 'react';
import { AsyncResource, init, map } from '@/utils/asyncResource';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { RULE_LOGIC_CONFIG } from '@/utils/queries/keys';
import { useIsChanged } from '@/utils/hooks';
import { makeConfig } from '@/components/ui/LogicBuilder/helpers';
import {
  RuleAggregationVariable,
  RuleEntityVariableInUse,
  RuleLogicConfig,
  RuleOperator,
} from '@/apis';
import { LogicBuilderConfig } from '@/components/ui/LogicBuilder/types';
import { getAggVarDefinition } from '@/pages/rules/RuleConfiguration/RuleConfigurationV2/steps/RuleParametersStep/utils';
import { getOperatorWithParameter } from '@/components/ui/LogicBuilder/operators';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

const InitialConfig = BasicConfig;

function getSupportedOperatorsKeys(operators: RuleOperator[], valueType: string): string[] {
  return operators.filter((v) => v.uiDefinition.valueTypes?.includes(valueType)).map((v) => v.key);
}

export function useRuleLogicConfig() {
  const v8Enabled = useFeatureEnabled('RULES_ENGINE_V8');
  const api = useApi();
  return useQuery<RuleLogicConfig>(
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
}

export function useLogicBuilderConfig(
  entityVariableTypes: Array<
    'TRANSACTION' | 'CONSUMER_USER' | 'BUSINESS_USER' | 'USER' | 'PAYMENT_DETAILS'
  >,
  entityVariablesInUse: RuleEntityVariableInUse[] | undefined,
  aggregationVariables: RuleAggregationVariable[],
  configParams: Partial<LogicBuilderConfig>,
): AsyncResource<Config> {
  const [result, setResult] = useState<AsyncResource<Config>>(init());
  const ruleLogicConfigResult = useRuleLogicConfig();
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
        const filteredEntityVariables = entityVariables
          .filter(
            (v) =>
              v.entity != null &&
              entityVariableTypes.includes(v.entity) &&
              (!entityVariablesInUse ||
                entityVariablesInUse.find((varInUse) => varInUse.key === v.key)),
          )
          .map((v) => ({
            ...v,
            uiDefinition: {
              ...v.uiDefinition,
              label:
                entityVariablesInUse?.find((varInUse) => varInUse.key === v.key)?.name ??
                v.uiDefinition.label,
            },
          }));
        const variables = filteredEntityVariables.concat(aggregationVariablesGrouped);
        const types = InitialConfig.types;
        for (const key in types) {
          if (types[key].widgets[key]) {
            const initialOperators = types[key].widgets[key].operators ?? [];
            types[key].widgets[key].operators = initialOperators.concat(
              getSupportedOperatorsKeys(operators, key),
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
                ...getSupportedOperatorsKeys(operators, 'multiselect'),
              ];
            } else if (key === 'text') {
              types[key].widgets[key].operators = [
                ...(types[key].widgets[key].operators ?? []),
                'select_any_in',
                'select_not_any_in',
              ];
              types[key].widgets['field'].operators = [
                ...(types[key].widgets['field'].operators ?? []),
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

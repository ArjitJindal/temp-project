import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Config, ImmutableTree, BuilderProps } from '@react-awesome-query-builder/antd';
import { AntdConfig, Query, Builder, Utils as QbUtils } from '@react-awesome-query-builder/antd';
import { getAggVarDefinition } from '../utils';
import { usePrevious } from '@/utils/hooks';
import { isSuccess } from '@/utils/asyncResource';
import { useApi } from '@/api';
import { RuleAggregationVariable, RuleLogicConfig } from '@/apis';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { RULE_LOGIC_CONFIG } from '@/utils/queries/keys';
import '@react-awesome-query-builder/antd/css/styles.css';
import { useQuery } from '@/utils/queries/hooks';

const InitialConfig = AntdConfig;

function getConfig(variables: any[], functions: any[], operators: any[]): Config {
  return {
    ...InitialConfig,
    settings: {
      ...InitialConfig.settings,
      fieldSources: ['field', 'func'],
      showErrorMessage: true,
    },
    types: {
      ...InitialConfig.types,
      text: {
        ...InitialConfig.types.text,
        ...{
          widgets: {
            text: {
              operators: [
                ...InitialConfig.types.text.widgets.text.operators!,
                ...operators
                  .filter((v) => v.uiDefinition.valueTypes?.includes('text'))
                  .map((v) => v.key),
              ],
            },
          },
        },
      },
    },
    operators: {
      ...InitialConfig.operators,
      ...Object.fromEntries(operators.map((v) => [v.key, v.uiDefinition])),
    },
    funcs: {
      ...InitialConfig.funcs,
      ...Object.fromEntries(functions.map((v) => [v.key, v.uiDefinition])),
    },
    fields: {
      ...Object.fromEntries(variables.map((v) => [v.key, v.uiDefinition])),
    },
  };
}

interface Props {
  jsonLogic: object | undefined;
  aggregationVariables: RuleAggregationVariable[] | undefined;
  onChange: (jsonLogic: object) => void;
}

export function RuleLogicEditorV8(props: Props) {
  const api = useApi();
  const ruleLogicConfig = useQuery<RuleLogicConfig>(
    RULE_LOGIC_CONFIG(),
    (): Promise<RuleLogicConfig> => api.getRuleLogicConfig(),
  );
  const [state, setState] = useState<{ tree: ImmutableTree; config: Config } | null>(null);
  const config = useMemo(() => {
    if (isSuccess(ruleLogicConfig.data) && props.aggregationVariables) {
      if (state === null) {
        const {
          variables: entityVariables,
          functions,
          operators,
        } = ruleLogicConfig.data?.value ?? {};
        const aggregationVariables = props.aggregationVariables.map((v) => {
          const definition = getAggVarDefinition(v, entityVariables ?? []);
          if (v.name) {
            definition.uiDefinition.label = v.name;
          }
          return definition;
        });
        const config = getConfig(
          (entityVariables ?? []).concat(aggregationVariables),
          functions ?? [],
          operators ?? [],
        );
        setState({
          tree: QbUtils.checkTree(
            props.jsonLogic
              ? QbUtils.loadFromJsonLogic(props.jsonLogic, config)!
              : QbUtils.loadTree({ id: QbUtils.uuid(), type: 'group' }),
            config,
          ),
          config,
        });
        return config;
      } else {
        return state.config;
      }
    }
    return getConfig([], [], []);
  }, [props.aggregationVariables, props.jsonLogic, ruleLogicConfig.data, state]);

  const prevAggregationVariables = usePrevious(props.aggregationVariables);
  useEffect(() => {
    if (prevAggregationVariables !== props.aggregationVariables) {
      setState(null);
    }
  }, [prevAggregationVariables, props.aggregationVariables]);

  const onChange = useCallback(
    (immutableTree: ImmutableTree, config: Config) => {
      // TODO (V8): Apply throttling
      setState((prevState) => {
        const newState = {
          ...prevState,
          tree: immutableTree,
          config,
        };
        const jsonLogic = QbUtils.jsonLogicFormat(newState.tree, newState.config);
        props.onChange(jsonLogic.logic!);
        return newState;
      });
    },
    [props],
  );
  const renderBuilder = useCallback((props: BuilderProps) => <Builder {...props} />, []);

  return (
    <AsyncResourceRenderer resource={ruleLogicConfig.data}>
      {() =>
        state && (
          <Query {...config} value={state.tree} onChange={onChange} renderBuilder={renderBuilder} />
        )
      }
    </AsyncResourceRenderer>
  );
}

import { useCallback, useMemo, useState } from 'react';
import type { Config, ImmutableTree, BuilderProps } from '@react-awesome-query-builder/antd';
import { AntdConfig, Query, Builder, Utils as QbUtils } from '@react-awesome-query-builder/antd';
import pluralize from 'pluralize';
import { lowerCase } from 'lodash';
import { isSuccess } from '@/utils/asyncResource';
import { useApi } from '@/api';
import { RuleAggregationFunc, RuleAggregationVariable, RuleLogicConfig } from '@/apis';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { RULE_LOGIC_CONFIG } from '@/utils/queries/keys';
import '@react-awesome-query-builder/antd/css/styles.css';
import { useQuery } from '@/utils/queries/hooks';
import { humanizeAuto } from '@/utils/humanize';

const InitialConfig = AntdConfig;

const AGG_FUNC_TO_TYPE: Record<RuleAggregationFunc, string> = {
  AVG: 'number',
  COUNT: 'number',
  SUM: 'number',
};

// TODO (V8): Improve entityVariables typings
function getAggVarDefinition(aggVar: RuleAggregationVariable, entityVariables: any[]) {
  const entityVariable = entityVariables.find((v) => v.key === aggVar.aggregationFieldKey);
  const { start, end } = aggVar.timeWindow;
  const startLabel = `${start.units} ${pluralize(lowerCase(start.granularity), start.units)} ago`;
  const endLabel =
    end.units === 0 ? '' : `${end.units} ${pluralize(lowerCase(end.granularity), end.units)} ago`;
  const timeWindowLabel = `${startLabel}${endLabel ? ` - ${endLabel}` : ''}`;
  const entityVariableLabel =
    aggVar.aggregationFunc === 'COUNT'
      ? lowerCase(pluralize(entityVariable.entity))
      : entityVariable?.uiDefinition?.label;
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
        const aggregationVariables = props.aggregationVariables.map((v) =>
          getAggVarDefinition(v, entityVariables ?? []),
        );
        const config = getConfig(
          (entityVariables ?? []).concat(aggregationVariables),
          functions ?? [],
          operators ?? [],
        );
        setState({
          tree: QbUtils.checkTree(QbUtils.loadFromJsonLogic(props.jsonLogic, config)!, config),
          config,
        });
        return config;
      } else {
        return state.config;
      }
    }
    return getConfig([], [], []);
  }, [props.aggregationVariables, props.jsonLogic, ruleLogicConfig.data, state]);

  const onChange = useCallback(
    (immutableTree: ImmutableTree, config: Config) => {
      // TODO: Apply throttling
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
  const renderBuilder = useCallback(
    (props: BuilderProps) => (
      <div className="query-builder-container">
        <div className="query-builder qb-lite">
          <Builder {...props} />
        </div>
      </div>
    ),
    [],
  );

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

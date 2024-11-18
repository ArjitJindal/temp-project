import { useCallback, useEffect, useState } from 'react';
import { Utils as QbUtils } from '@react-awesome-query-builder/ui';
import { isEqual } from 'lodash';
import { useLogicBuilderConfig } from '../helpers';
import LogicBuilder, { Props as LogicBuilderProps } from '@/components/ui/LogicBuilder';
import {
  LogicBuilderConfig,
  LogicBuilderValue,
  QueryBuilderConfig,
} from '@/components/ui/LogicBuilder/types';
import { isSuccess } from '@/utils/asyncResource';
import { useIsChanged, usePrevious } from '@/utils/hooks';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import {
  LogicAggregationVariable,
  LogicEntityVariableEntityEnum,
  LogicEntityVariableInUse,
  RuleMachineLearningVariable,
  RuleType,
} from '@/apis';
import { RuleLogic } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/types';

interface Props {
  ruleType: RuleType;
  jsonLogic: RuleLogic | undefined;
  entityVariableTypes?: LogicEntityVariableEntityEnum[];
  entityVariablesInUse?: LogicEntityVariableInUse[];
  aggregationVariables: LogicAggregationVariable[] | undefined;
  mlVariables?: RuleMachineLearningVariable[];
  onChange?: (jsonLogic: RuleLogic | undefined) => void;
  configParams?: Partial<LogicBuilderConfig>;
  logicBuilderProps?: Partial<LogicBuilderProps>;
}
type State = { tree: LogicBuilderValue; config: QueryBuilderConfig } | null;

export function RuleLogicBuilder(props: Props) {
  const { jsonLogic, logicBuilderProps, configParams, ruleType, onChange } = props;
  const [state, setState] = useState<State>(null);

  // Initialize state when config is loaded or changed
  const configRes = useLogicBuilderConfig(
    ruleType,
    props.entityVariableTypes,
    props.entityVariablesInUse,
    props.aggregationVariables ?? [],
    configParams ?? {},
    props.mlVariables ?? [],
  );

  const isConfigChanged = useIsChanged(configRes);
  const handleChangeLogic = useCallback(
    (newState: State) => {
      if (newState == null || newState.tree == null) {
        return;
      }
      const currentJsonLogic = QbUtils.jsonLogicFormat(newState.tree, newState.config);
      if (!isEqual(currentJsonLogic.logic, jsonLogic)) {
        onChange?.(currentJsonLogic.logic as RuleLogic | undefined);
      }
    },
    [jsonLogic, onChange],
  );
  useEffect(() => {
    if (isSuccess(configRes) && props.aggregationVariables) {
      let isJsonLogicChanged = false;
      const config = configRes.value;

      let propsTree = QbUtils.loadFromJsonLogic(jsonLogic, config);
      propsTree = propsTree ? QbUtils.checkTree(propsTree, config) : undefined;

      if (state && !state.tree && jsonLogic) {
        isJsonLogicChanged = true;
      }
      if (state && state.tree && jsonLogic) {
        const jsonLogic = QbUtils.jsonLogicFormat(state.tree, config).logic;
        const propsJsonLogic = propsTree
          ? QbUtils.jsonLogicFormat(propsTree, config).logic
          : undefined;
        isJsonLogicChanged = !isEqual(jsonLogic, propsJsonLogic);
      }

      if (state === null || isConfigChanged || isJsonLogicChanged) {
        setState((prevState) => {
          const newState: State = {
            ...prevState,
            tree: propsTree,
            config,
          };
          handleChangeLogic(newState);
          return newState;
        });
      }
    }
  }, [configRes, props.aggregationVariables, jsonLogic, state, isConfigChanged, handleChangeLogic]);

  const prevAggregationVariables = usePrevious(props.aggregationVariables);
  useEffect(() => {
    if (!isEqual(prevAggregationVariables, props.aggregationVariables)) {
      setState(null);
    }
  }, [prevAggregationVariables, props.aggregationVariables]);

  const handleChange = useCallback(
    (immutableTree: LogicBuilderValue, config: QueryBuilderConfig) => {
      setState((prevState) => {
        const newState = {
          ...prevState,
          tree: immutableTree,
          config,
        };
        handleChangeLogic(newState);
        return newState;
      });
    },
    [handleChangeLogic],
  );

  return (
    <AsyncResourceRenderer resource={configRes}>
      {() =>
        state ? (
          <LogicBuilder
            data-cy="logic-builder"
            value={state.tree}
            config={state.config}
            onChange={handleChange}
            {...logicBuilderProps}
          />
        ) : (
          <></>
        )
      }
    </AsyncResourceRenderer>
  );
}

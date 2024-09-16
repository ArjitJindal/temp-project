import { useState, useEffect, useCallback } from 'react';
import { Config, Utils as QbUtils } from '@react-awesome-query-builder/ui';
import { isEqual } from 'lodash';
import { useLogicBuilderConfig } from '../helpers';
import LogicBuilder, { Props as LogicBuilderProps } from '@/components/ui/LogicBuilder';
import { LogicBuilderValue, LogicBuilderConfig } from '@/components/ui/LogicBuilder/types';
import { isSuccess } from '@/utils/asyncResource';
import { usePrevious, useIsChanged } from '@/utils/hooks';
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
  entityVariableTypes: LogicEntityVariableEntityEnum[];
  entityVariablesInUse?: LogicEntityVariableInUse[];
  aggregationVariables: LogicAggregationVariable[] | undefined;
  mlVariables?: RuleMachineLearningVariable[];
  onChange: (jsonLogic: RuleLogic | undefined) => void;
  configParams?: Partial<LogicBuilderConfig>;
  logicBuilderProps?: Partial<LogicBuilderProps>;
}
type State = { tree: LogicBuilderValue; config: Config } | null;

export function RuleLogicBuilder(props: Props) {
  const { logicBuilderProps, configParams, ruleType } = props;
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
      const jsonLogic = QbUtils.jsonLogicFormat(newState.tree, newState.config);
      if (!isEqual(jsonLogic.logic, props.jsonLogic)) {
        props.onChange(jsonLogic.logic as RuleLogic | undefined);
      }
    },
    [props],
  );
  useEffect(() => {
    if (isSuccess(configRes) && props.aggregationVariables) {
      let isJsonLogicChanged = false;
      const config = configRes.value;
      if (state && !state.tree && props.jsonLogic) {
        isJsonLogicChanged = true;
      }
      if (state && state.tree && props.jsonLogic) {
        const jsonLogic = QbUtils.jsonLogicFormat(state.tree, config).logic;
        isJsonLogicChanged = !isEqual(jsonLogic, props.jsonLogic);
      }
      if (state === null || isConfigChanged || isJsonLogicChanged) {
        setState((prevState) => {
          const tree = QbUtils.loadFromJsonLogic(props.jsonLogic, config);
          const newState: State = {
            ...prevState,
            tree: tree ? QbUtils.checkTree(tree, config) : undefined,
            config,
          };
          handleChangeLogic(newState);
          return newState;
        });
      }
    }
  }, [
    configRes,
    props.aggregationVariables,
    props.jsonLogic,
    state,
    isConfigChanged,
    handleChangeLogic,
  ]);

  const prevAggregationVariables = usePrevious(props.aggregationVariables);
  useEffect(() => {
    if (!isEqual(prevAggregationVariables, props.aggregationVariables)) {
      setState(null);
    }
  }, [prevAggregationVariables, props.aggregationVariables]);

  const onChange = useCallback(
    (immutableTree: LogicBuilderValue, config: Config) => {
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
            onChange={onChange}
            {...logicBuilderProps}
          />
        ) : (
          <></>
        )
      }
    </AsyncResourceRenderer>
  );
}

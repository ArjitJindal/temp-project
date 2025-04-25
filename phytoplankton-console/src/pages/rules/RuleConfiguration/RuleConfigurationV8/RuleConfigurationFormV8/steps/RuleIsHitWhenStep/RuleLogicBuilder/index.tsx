import { useCallback, useEffect, useState } from 'react';
import { Utils as QbUtils, Settings } from '@react-awesome-query-builder/ui';
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
import Spinner from '@/components/library/Spinner';
import { jsonLogicFormat, jsonLogicParse } from '@/components/ui/LogicBuilder/virtual-fields';

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
  settings?: Partial<Settings>;
}
type State = { tree: LogicBuilderValue; config: QueryBuilderConfig } | null;

export function RuleLogicBuilder(props: Props) {
  const { jsonLogic, logicBuilderProps, configParams, ruleType, onChange, settings } = props;
  const [state, setState] = useState<State>(null);

  // Initialize state when config is loaded or changed
  const configRes = useLogicBuilderConfig(
    ruleType,
    props.entityVariableTypes,
    props.entityVariablesInUse,
    props.aggregationVariables ?? [],
    configParams ?? {},
    props.mlVariables ?? [],
    settings,
  );

  const isConfigChanged = useIsChanged(configRes);
  const handleChangeLogic = useCallback(
    (newState: State) => {
      if (newState == null || newState.tree == null) {
        return;
      }
      let currentJsonLogic;
      try {
        currentJsonLogic = jsonLogicFormat(newState.tree, newState.config);
      } catch (e) {
        console.warn(e);
      }
      if (!isEqual(currentJsonLogic?.logic, jsonLogic)) {
        onChange?.(currentJsonLogic?.logic as RuleLogic | undefined);
      }
    },
    [jsonLogic, onChange],
  );
  useEffect(() => {
    if (isSuccess(configRes) && props.aggregationVariables) {
      let isJsonLogicChanged = false;
      const config = configRes.value;

      let propsTree = jsonLogicParse(jsonLogic, config);

      propsTree = propsTree ? QbUtils.checkTree(propsTree, config) : undefined;

      if (state && !state.tree && jsonLogic) {
        isJsonLogicChanged = true;
      }
      if (state && state.tree && jsonLogic) {
        const jsonLogic = jsonLogicFormat(state.tree, config);
        const propsJsonLogic = propsTree ? jsonLogicFormat(propsTree, config) : undefined;
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
          <Spinner />
        )
      }
    </AsyncResourceRenderer>
  );
}

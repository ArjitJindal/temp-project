import { useState, useEffect, useCallback, useMemo } from 'react';
import { Config, Utils as QbUtils } from '@react-awesome-query-builder/ui';
import { isEqual, debounce } from 'lodash';
import { useLogicBuilderConfig } from '../helpers';
import LogicBuilder from '@/components/ui/LogicBuilder';
import { LogicBuilderValue } from '@/components/ui/LogicBuilder/types';
import { isSuccess } from '@/utils/asyncResource';
import { usePrevious, useIsChanged } from '@/utils/hooks';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { RuleAggregationVariable } from '@/apis';

interface Props {
  jsonLogic: object | undefined;
  entityVariableTypes: Array<'TRANSACTION' | 'CONSUMER_USER' | 'BUSINESS_USER' | 'USER'>;
  aggregationVariables: RuleAggregationVariable[] | undefined;
  onChange: (jsonLogic: object | undefined) => void;
}
type State = { tree: LogicBuilderValue; config: Config } | null;

export function RuleLogicBuilder(props: Props) {
  const [state, setState] = useState<State>(null);

  // Initialize state when config is loaded or changed
  const configRes = useLogicBuilderConfig(
    props.entityVariableTypes,
    props.aggregationVariables ?? [],
  );
  const isConfigChanged = useIsChanged(configRes);
  useEffect(() => {
    if (isSuccess(configRes) && props.aggregationVariables) {
      if (state === null || isConfigChanged) {
        const config = configRes.value;
        setState((prevState) => {
          const tree = QbUtils.loadFromJsonLogic(props.jsonLogic, config);
          return {
            ...prevState,
            tree: tree ? QbUtils.checkTree(tree, config) : undefined,
            config,
          };
        });
      }
    }
  }, [configRes, props.aggregationVariables, props.jsonLogic, state, isConfigChanged]);

  const prevAggregationVariables = usePrevious(props.aggregationVariables);
  useEffect(() => {
    if (!isEqual(prevAggregationVariables, props.aggregationVariables)) {
      setState(null);
    }
  }, [prevAggregationVariables, props.aggregationVariables]);
  const handleChangeLogic = useCallback(
    (newState: State) => {
      if (!newState) {
        return;
      }
      const jsonLogic = QbUtils.jsonLogicFormat(newState.tree!, newState.config);
      if (!isEqual(jsonLogic.logic, props.jsonLogic)) {
        props.onChange(jsonLogic.logic!);
      }
    },
    [props],
  );
  const debouncedHandleChangeLogic = useMemo(
    () => debounce(handleChangeLogic, 1000),
    [handleChangeLogic],
  );

  const onChange = useCallback(
    (immutableTree: LogicBuilderValue, config: Config) => {
      setState((prevState) => {
        const newState = {
          ...prevState,
          tree: immutableTree,
          config,
        };
        debouncedHandleChangeLogic(newState);
        return newState;
      });
    },
    [debouncedHandleChangeLogic],
  );

  return (
    <AsyncResourceRenderer resource={configRes}>
      {() =>
        state ? (
          <LogicBuilder value={state.tree} config={state.config} onChange={onChange} />
        ) : (
          <></>
        )
      }
    </AsyncResourceRenderer>
  );
}

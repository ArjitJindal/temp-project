import { useState, useEffect, useCallback } from 'react';
import { Config, Utils as QbUtils } from '@react-awesome-query-builder/ui';
import { isEqual } from 'lodash';
import { useLogicBuilderConfig } from '../helpers';
import LogicBuilder from '@/components/ui/LogicBuilder';
import { LogicBuilderValue } from '@/components/ui/LogicBuilder/types';
import { isSuccess } from '@/utils/asyncResource';
import { usePrevious } from '@/utils/hooks';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { RuleAggregationVariable } from '@/apis';

interface Props {
  jsonLogic: object | undefined;
  entityVariableTypes: Array<'TRANSACTION' | 'CONSUMER_USER' | 'BUSINESS_USER'>;
  aggregationVariables: RuleAggregationVariable[] | undefined;
  onChange: (jsonLogic: object | undefined) => void;
}

export function RuleLogicBuilder(props: Props) {
  const [state, setState] = useState<{ tree: LogicBuilderValue; config: Config } | null>(null);

  // Initialize state when config is loaded or changed
  const configRes = useLogicBuilderConfig(
    props.entityVariableTypes,
    props.aggregationVariables ?? [],
  );
  useEffect(() => {
    if (isSuccess(configRes) && props.aggregationVariables) {
      if (state === null) {
        const config = configRes.value;
        setState((prevState) => ({
          ...prevState,
          tree: QbUtils.checkTree(QbUtils.loadFromJsonLogic(props.jsonLogic, config)!, config),
          config,
        }));
      }
    }
  }, [configRes, props.aggregationVariables, props.jsonLogic, state]);

  const prevAggregationVariables = usePrevious(props.aggregationVariables);
  useEffect(() => {
    if (!isEqual(prevAggregationVariables, props.aggregationVariables)) {
      setState(null);
    }
  }, [prevAggregationVariables, props.aggregationVariables]);

  const onChange = useCallback(
    (immutableTree: LogicBuilderValue, config: Config) => {
      // TODO (V8): Apply throttling
      setState((prevState) => {
        const newState = {
          ...prevState,
          tree: immutableTree,
          config,
        };
        const jsonLogic = QbUtils.jsonLogicFormat(newState.tree!, newState.config);
        props.onChange(jsonLogic.logic!);
        return newState;
      });
    },
    [props],
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

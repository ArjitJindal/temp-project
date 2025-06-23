import { useCallback, useEffect, useState } from 'react';
import { Settings } from '@react-awesome-query-builder/ui';
import { isEqual } from 'lodash';
import { useRuleLogicBuilderConfig } from '../../../helpers';
import { collectVarNamesFromTree } from './helpers';
import LogicBuilder, { Props as LogicBuilderProps } from '@/components/ui/LogicBuilder';
import {
  LogicBuilderConfig,
  LogicBuilderValue,
  QueryBuilderConfig,
} from '@/components/ui/LogicBuilder/types';
import { isSuccess, useFinishedSuccessfully } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import {
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
  mlVariables?: RuleMachineLearningVariable[];
  onChange?: (jsonLogic: RuleLogic | undefined) => void;
  configParams?: Partial<LogicBuilderConfig>;
  logicBuilderProps?: Partial<LogicBuilderProps>;
  settings?: Partial<Settings>;
}
type State = { tree: LogicBuilderValue; config: QueryBuilderConfig } | null;

export default function FiltersLogicBuilder(props: Props) {
  const { jsonLogic, logicBuilderProps, configParams, ruleType, onChange, settings } = props;
  const [state, setState] = useState<State>(null);

  const [mentionedVariables, setMentionedVariables] = useState<string[]>([]);

  // Initialize state when config is loaded or changed
  const configRes = useRuleLogicBuilderConfig(
    ruleType,
    props.entityVariableTypes,
    props.entityVariablesInUse,
    mentionedVariables,
    [],
    configParams ?? {},
    props.mlVariables ?? [],
    settings,
  );

  const isFinishedSuccessfully = useFinishedSuccessfully(configRes);
  useEffect(() => {
    if ((isFinishedSuccessfully || state == null) && isSuccess(configRes)) {
      setState((prevState) =>
        prevState
          ? {
              ...prevState,
              config: {
                ...configRes.value,
              },
            }
          : {
              tree: jsonLogicParse(jsonLogic, configRes.value),
              config: {
                ...configRes.value,
              },
            },
      );
    }
  }, [state, isFinishedSuccessfully, jsonLogic, configRes]);

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

  const handleChange = useCallback(
    (immutableTree: LogicBuilderValue, config: QueryBuilderConfig) => {
      if (immutableTree) {
        const usedVariables = collectVarNamesFromTree(immutableTree);
        setMentionedVariables(usedVariables);
      }

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

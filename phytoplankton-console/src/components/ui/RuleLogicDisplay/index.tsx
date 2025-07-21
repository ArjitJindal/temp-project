import React from 'react';
import {
  LogicAggregationVariable,
  LogicEntityVariableInUse,
  RuleMachineLearningVariable,
  RuleType,
} from '@/apis';
import { useRuleLogicBuilderConfig } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/helpers';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { QueryBuilderConfig } from '@/components/ui/LogicBuilder/types';
import LogicBuilder from '@/components/ui/LogicBuilder';
import Alert from '@/components/library/Alert';

const CONFIG_PARAMS = {
  mode: 'VIEW',
} as const;

type JsonLogic = Record<string, unknown> | null | undefined;

interface Props {
  ruleLogic: JsonLogic;
  ruleType: RuleType;
  logicEntityVariables?: Array<LogicEntityVariableInUse>;
  logicAggregationVariables?: Array<LogicAggregationVariable>;
  logicMachineLearningVariables?: Array<RuleMachineLearningVariable>;
}

function isValidJsonLogic(value: JsonLogic): value is Record<string, unknown> {
  return value != null && typeof value === 'object';
}

export default function RuleLogicDisplay(props: Props) {
  const {
    ruleLogic,
    ruleType,
    logicEntityVariables,
    logicAggregationVariables,
    logicMachineLearningVariables,
  } = props;

  const newLogicBuildConfigRes = useRuleLogicBuilderConfig(
    ruleType,
    undefined,
    logicEntityVariables,
    logicEntityVariables?.map((v) => v.entityKey) ?? [],
    logicAggregationVariables ?? [],
    CONFIG_PARAMS,
    logicMachineLearningVariables ?? [],
  );

  return (
    <AsyncResourceRenderer resource={newLogicBuildConfigRes}>
      {(logicBuildConfig: QueryBuilderConfig) => {
        if (!isValidJsonLogic(ruleLogic)) {
          return <Alert type={'ERROR'}>Invalid rule logic format</Alert>;
        }

        return <LogicBuilder jsonLogic={ruleLogic} config={logicBuildConfig} />;
      }}
    </AsyncResourceRenderer>
  );
}

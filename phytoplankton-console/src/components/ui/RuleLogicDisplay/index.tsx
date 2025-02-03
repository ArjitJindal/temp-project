import { Utils as QbUtils } from '@react-awesome-query-builder/ui';
import React from 'react';
import {
  LogicAggregationVariable,
  LogicEntityVariableInUse,
  RuleMachineLearningVariable,
  RuleType,
} from '@/apis';
import { useLogicBuilderConfig } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/helpers';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { QueryBuilderConfig } from '@/components/ui/LogicBuilder/types';
import LogicBuilder from '@/components/ui/LogicBuilder';
import Alert from '@/components/library/Alert';

const CONFIG_PARAMS = {
  mode: 'VIEW',
} as const;

interface Props {
  ruleLogic: any;
  ruleType: RuleType;
  logicEntityVariables?: Array<LogicEntityVariableInUse>;
  logicAggregationVariables?: Array<LogicAggregationVariable>;
  logicMachineLearningVariables?: Array<RuleMachineLearningVariable>;
}

export default function RuleLogicDisplay(props: Props) {
  const {
    ruleLogic,
    ruleType,
    logicEntityVariables,
    logicAggregationVariables,
    logicMachineLearningVariables,
  } = props;

  const newLogicBuildConfigRes = useLogicBuilderConfig(
    ruleType,
    undefined,
    logicEntityVariables,
    logicAggregationVariables ?? [],
    CONFIG_PARAMS,
    logicMachineLearningVariables ?? [],
  );

  return (
    <AsyncResourceRenderer resource={newLogicBuildConfigRes}>
      {(logicBuildConfig: QueryBuilderConfig) => {
        const [propsTree, errors] = QbUtils._loadFromJsonLogic(ruleLogic, logicBuildConfig);
        if (errors.length > 0) {
          return <Alert type={'ERROR'}>Unable to display rule logic. {errors.join('; ')}</Alert>;
        }
        const checkedPropsTree = propsTree
          ? QbUtils.checkTree(propsTree, logicBuildConfig)
          : undefined;
        return <LogicBuilder value={checkedPropsTree} config={logicBuildConfig} />;
      }}
    </AsyncResourceRenderer>
  );
}

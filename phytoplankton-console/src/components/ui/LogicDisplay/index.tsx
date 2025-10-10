import { Utils as QbUtils } from '@react-awesome-query-builder/ui';
import LogicBuilder from '../LogicBuilder';
import { QueryBuilderConfig } from '../LogicBuilder/types';
import {
  LogicAggregationVariable,
  LogicEntityVariableInUse,
  RuleMachineLearningVariable,
  RuleType,
} from '@/apis';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useRuleLogicBuilderConfig } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/helpers';

interface Props {
  logic: object | undefined;
  entityVariables: LogicEntityVariableInUse[];
  aggregationVariables?: LogicAggregationVariable[];
  machineLearningVariables?: RuleMachineLearningVariable[];
  ruleType: RuleType;
}

/**
 * Wrapper around the LogicBuilder component to work in view-mode only
 */
export default function LogicDisplay(props: Props) {
  const {
    logic,
    entityVariables,
    aggregationVariables = [],
    machineLearningVariables = [],
    ruleType,
  } = props;
  const logicBuildConfigRes = useRuleLogicBuilderConfig(
    ruleType,
    undefined,
    entityVariables,
    entityVariables.map((v) => v.entityKey) ?? [],
    aggregationVariables,
    {
      mode: 'VIEW',
    },
    machineLearningVariables ?? [],
  );

  return (
    <AsyncResourceRenderer resource={logicBuildConfigRes}>
      {(logicBuildConfig: QueryBuilderConfig) => {
        let propsTree = QbUtils.loadFromJsonLogic(logic, logicBuildConfig);
        propsTree = propsTree ? QbUtils.checkTree(propsTree, logicBuildConfig) : undefined;

        return <LogicBuilder value={propsTree} config={logicBuildConfig} />;
      }}
    </AsyncResourceRenderer>
  );
}

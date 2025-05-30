import RuleConfigurationV2, { Props as V2Props } from './RuleConfigurationV2';
import RuleConfigurationV8, { Props as V8Props } from './RuleConfigurationV8';
import {
  Props as SimulationProps,
  RuleConfigurationSimulation,
} from '@/pages/rules/RuleConfiguration/RuleConfigurationSimulation';
import { useShouldUseV8Configuration } from '@/pages/rules/utils';
import { useHasPermissions } from '@/utils/user-utils';

type Props = V8Props &
  V2Props &
  Omit<SimulationProps, 'ruleInstance'> & {
    isSimulation: boolean;
  };

export default function RuleConfiguration(props: Props) {
  const canWriteRules = useHasPermissions(['rules:my-rules:write'], ['write:::rules/my-rules/*']);
  const useV8Configuration = useShouldUseV8Configuration(props.rule, props.ruleInstance);
  const readOnly = !canWriteRules || props.readOnly;

  let ruleInstance = props.ruleInstance;
  if (ruleInstance && props.type === 'DUPLICATE' && ruleInstance.ruleNameAlias) {
    ruleInstance = {
      ...ruleInstance,
      ruleNameAlias: `Copy of ${ruleInstance.ruleNameAlias}`,
    };
  }

  if (props.isSimulation) {
    return (
      <RuleConfigurationSimulation
        {...props}
        v8Mode={useV8Configuration}
        ruleInstance={{
          ruleId: props.rule?.id,
          logic: props.rule?.defaultLogic,
          riskLevelLogic: props.rule?.defaultRiskLevelLogic,
          logicAggregationVariables: props.rule?.defaultLogicAggregationVariables,
          parameters: props.rule?.defaultParameters,
          riskLevelParameters: props.rule?.defaultRiskLevelParameters,
          action: props.rule?.defaultAction,
          riskLevelActions: props.rule?.defaultRiskLevelActions,
          nature: props.rule?.defaultNature ?? 'AML',
          casePriority: props.rule?.defaultCasePriority ?? 'P1',
          filters: props.rule?.defaultFilters,
          labels: [],
          checksFor: props.rule?.checksFor ?? [],
          type: props.rule?.type ?? 'TRANSACTION',
          ruleExecutionMode: 'SYNC',
          ruleRunMode: 'LIVE',
          ...props.ruleInstance,
        }}
      />
    );
  }
  if (useV8Configuration) {
    return <RuleConfigurationV8 {...props} ruleInstance={ruleInstance} readOnly={readOnly} />;
  }
  return <RuleConfigurationV2 {...props} ruleInstance={ruleInstance} readOnly={readOnly} />;
}

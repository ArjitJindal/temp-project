import React from 'react';
import {
  RuleConfigurationSimulation,
  Props as SimulationProps,
} from 'src/pages/rules/RuleConfiguration/RuleConfigurationV2/RuleConfigurationSimulation';
import RuleConfigurationV2, { Props as V2Props } from './RuleConfigurationV2';
import RuleConfigurationV8, { Props as V8Props } from './RuleConfigurationV8';
import { useIsV8RuleInstance } from '@/pages/rules/utils';
import { useHasPermissions } from '@/utils/user-utils';

type Props = V8Props &
  V2Props &
  Omit<SimulationProps, 'ruleInstance'> & {
    isSimulation: boolean;
  };

export default function RuleConfiguration(props: Props) {
  const canWriteRules = useHasPermissions(['rules:my-rules:write']);
  const readOnly = !canWriteRules || props.readOnly;

  let ruleInstance = props.ruleInstance;
  if (ruleInstance && props.type === 'DUPLICATE' && ruleInstance.ruleNameAlias) {
    ruleInstance = {
      ...ruleInstance,
      ruleNameAlias: `Copy of ${ruleInstance.ruleNameAlias}`,
    };
  }

  const isV8 = useIsV8RuleInstance(ruleInstance);

  if (isV8 || props.rule == null) {
    return <RuleConfigurationV8 {...props} ruleInstance={ruleInstance} readOnly={readOnly} />;
  }
  return props.isSimulation ? (
    <RuleConfigurationSimulation
      {...props}
      ruleInstance={{
        ruleId: props.rule.id,
        parameters: props.rule.defaultParameters,
        riskLevelParameters: props.rule.defaultRiskLevelParameters,
        action: props.rule.defaultAction,
        riskLevelActions: props.rule.defaultRiskLevelActions,
        nature: props.rule.defaultNature,
        casePriority: props.rule.defaultCasePriority,
        filters: props.rule.defaultFilters,
        labels: [],
        checksFor: props.rule.checksFor,
        type: props.rule.type,
      }}
    />
  ) : (
    <RuleConfigurationV2 {...props} ruleInstance={ruleInstance} readOnly={readOnly} />
  );
}

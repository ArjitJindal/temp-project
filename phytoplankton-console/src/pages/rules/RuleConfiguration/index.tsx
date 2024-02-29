import React from 'react';
import {
  RuleConfigurationSimulation,
  Props as SimulationProps,
} from 'src/pages/rules/RuleConfiguration/RuleConfigurationV2/RuleConfigurationSimulation';
import RuleConfigurationV2, { Props as V2Props } from './RuleConfigurationV2';
import RuleConfigurationV8, { Props as V8Props } from './RuleConfigurationV8';
import { useIsV8RuleInstance, useIsV8Rule } from '@/pages/rules/utils';
import { useHasPermissions } from '@/utils/user-utils';
import { RuleInstance } from '@/apis';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

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

  const isV8LibraryEnabled = useFeatureEnabled('RULES_ENGINE_V8_LIBRARY');
  const isRuleV8 = useIsV8Rule(props.rule);
  const isInstanceV8 = useIsV8RuleInstance({
    ruleId: props.rule?.id,
    type: props.rule?.type ?? 'TRANSACTION',
    logic: props.rule?.defaultLogic,
    logicAggregationVariables: props.rule?.defaultLogicAggregationVariables,
  } as RuleInstance);

  if (isInstanceV8 || props.rule == null) {
    return <RuleConfigurationV8 {...props} ruleInstance={ruleInstance} readOnly={readOnly} />;
  }
  if (props.isSimulation) {
    return (
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
    );
  } else if (isRuleV8 && isV8LibraryEnabled) {
    return <RuleConfigurationV8 {...props} readOnly={readOnly} />;
  } else {
    return <RuleConfigurationV2 {...props} ruleInstance={ruleInstance} readOnly={readOnly} />;
  }
}

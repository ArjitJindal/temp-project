import React from 'react';
import { Tabs } from 'antd';
import { RiskLevelRuleActions, RiskLevelRuleParameters, Rule, RuleAction } from '@/apis';
import JsonSchemaEditor from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor';
import StepHeader from '@/pages/rules/RuleConfigurationDrawer/StepHeader';
import { RISK_LEVELS } from '@/utils/risk-levels';
import { getRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import RuleActionSelector from '@/pages/rules/RuleConfigurationDrawer/steps/RuleParametersStep/RuleActionSelector';
import { PropertyListLayout } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/PropertyList';
import NestedForm from '@/components/library/Form/NestedForm';
import InputField from '@/components/library/Form/InputField';

export interface FormValues {
  ruleParameters?: unknown;
  ruleAction?: RuleAction;
  riskLevelParameters?: RiskLevelRuleParameters;
  riskLevelActions?: RiskLevelRuleActions;
}

export const INITIAL_VALUES: FormValues = {
  ruleParameters: undefined,
  riskLevelParameters: undefined,
  riskLevelActions: undefined,
  ruleAction: undefined,
};

interface Props {
  activeTab: string;
  rule: Rule;
}

export default function RuleParametersStep(props: Props) {
  const { activeTab } = props;

  return (
    <>
      {activeTab === 'rule_specific_filters' && <RuleSpecificFilters {...props} />}
      {activeTab === 'risk_based_thresholds' && <RiskBasedThresholds {...props} />}
    </>
  );
}

function RuleSpecificFilters(props: Props) {
  const { rule } = props;

  return (
    <>
      <StepHeader
        title={'Rule-specific filters'}
        description={'Configure filters that are specific for this rule'}
      />
      <PropertyListLayout>
        <NestedForm name={'ruleParameters'}>
          <JsonSchemaEditor parametersSchema={rule.parametersSchema} />
        </NestedForm>
        <InputField<FormValues, 'ruleAction'>
          name={'ruleAction'}
          label={'Rule Actions'}
          description={'Select the action to perform if this rule is hit'}
        >
          {(inputProps) => <RuleActionSelector {...inputProps} />}
        </InputField>
      </PropertyListLayout>
    </>
  );
}

function RiskBasedThresholds(props: Props) {
  const { rule } = props;
  const settings = useSettings();
  return (
    <>
      <StepHeader
        title={'Risk-based thresholds'}
        description={'Configure risk-based thresholds that are specific for this rule'}
      />
      <Tabs type="line">
        {RISK_LEVELS.map((riskLevel) => (
          <Tabs.TabPane tab={getRiskLevelLabel(riskLevel, settings)} key={riskLevel}>
            <PropertyListLayout>
              <NestedForm<FormValues> name={'riskLevelParameters'}>
                <NestedForm<FormValues['riskLevelParameters']> name={riskLevel}>
                  <JsonSchemaEditor parametersSchema={rule.parametersSchema} />
                </NestedForm>
              </NestedForm>
              <NestedForm<FormValues> name={'riskLevelActions'}>
                <InputField<any>
                  name={riskLevel}
                  label={'Rule Actions'}
                  description={`Select the action to perform if this rule is hit for users of ${getRiskLevelLabel(
                    riskLevel,
                    settings,
                  )} risk level`}
                >
                  {(inputProps) => <RuleActionSelector {...inputProps} />}
                </InputField>
              </NestedForm>
            </PropertyListLayout>
          </Tabs.TabPane>
        ))}
      </Tabs>
    </>
  );
}

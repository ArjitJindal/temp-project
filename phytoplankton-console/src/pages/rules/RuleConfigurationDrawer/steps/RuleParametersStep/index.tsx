import React from 'react';
import { Tabs } from 'antd';
import { capitalize, toLower } from 'lodash';
import s from './style.module.less';
import { RiskLevelRuleActions, RiskLevelRuleParameters, Rule, RuleAction } from '@/apis';
import JsonSchemaEditor from '@/components/library/JsonSchemaEditor';
import StepHeader from '@/pages/rules/RuleConfigurationDrawer/StepHeader';
import { RISK_LEVELS } from '@/utils/risk-levels';
import { getRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import RuleActionSelector from '@/pages/rules/RuleConfigurationDrawer/steps/RuleParametersStep/RuleActionSelector';
import { PropertyListLayout } from '@/components/library/JsonSchemaEditor/PropertyList';
import NestedForm from '@/components/library/Form/NestedForm';
import InputField from '@/components/library/Form/InputField';
import { useFieldState, useFormState } from '@/components/library/Form/utils/hooks';
import ApplyRiskLevels from '@/pages/rules/RuleConfigurationDrawer/steps/RuleParametersStep/ApplyRiskLevels';

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
  defaultInitialValues: FormValues;
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
          label={'Rule actions'}
          description={'Select the action to perform if this rule is hit'}
        >
          {(inputProps) => <RuleActionSelector {...inputProps} />}
        </InputField>
      </PropertyListLayout>
    </>
  );
}

function RiskBasedThresholds(props: Props) {
  const { rule, defaultInitialValues } = props;
  const settings = useSettings();
  const formState = useFormState<FormValues>();
  const riskLevelParametersField = useFieldState<FormValues, 'riskLevelParameters'>(
    'riskLevelParameters',
  );
  const riskLevelActionsField = useFieldState<FormValues, 'riskLevelActions'>('riskLevelActions');

  return (
    <>
      <StepHeader
        title={'Risk-based thresholds'}
        description={'Configure risk-based thresholds that are specific for this rule'}
      />
      <Tabs type="line">
        {RISK_LEVELS.map((riskLevel) => {
          // const isInitial = isEqual(
          //   removeEmpty(formState.values.riskLevelParameters?.[riskLevel]),
          //   defaultInitialValues.riskLevelParameters?.[riskLevel],
          // );
          return (
            <Tabs.TabPane
              tab={
                <div className={s.riskLevelTabLabel}>
                  {/*{!isInitial && <CheckboxCircleFillIcon />}*/}
                  {capitalize(getRiskLevelLabel(riskLevel, settings))}
                </div>
              }
              key={riskLevel}
            >
              <PropertyListLayout>
                <NestedForm<FormValues> name={'riskLevelParameters'}>
                  <NestedForm<FormValues['riskLevelParameters']> name={riskLevel}>
                    <JsonSchemaEditor parametersSchema={rule.parametersSchema} />
                  </NestedForm>
                </NestedForm>
                <NestedForm<FormValues> name={'riskLevelActions'}>
                  <InputField<any>
                    name={riskLevel}
                    label={'Rule actions'}
                    description={`Select the action to perform if this rule is hit for users of ${toLower(
                      getRiskLevelLabel(riskLevel, settings),
                    )} risk level`}
                  >
                    {(inputProps) => <RuleActionSelector {...inputProps} />}
                  </InputField>
                </NestedForm>
                <ApplyRiskLevels
                  defaultInitialValues={defaultInitialValues.riskLevelParameters}
                  currentRiskLevel={riskLevel}
                  formValues={formState.values}
                  onConfirm={(riskLevels) => {
                    const currentRiskLevelParams = riskLevelParametersField?.value?.[riskLevel];
                    const currentRiskLevelActions = riskLevelActionsField?.value?.[riskLevel];
                    let newParams: RiskLevelRuleParameters | undefined = undefined;
                    let newActions: RiskLevelRuleActions | undefined = undefined;
                    if (currentRiskLevelParams && riskLevelParametersField.value) {
                      newParams = riskLevels.reduce<RiskLevelRuleParameters>(
                        (acc, riskLevel) => ({
                          ...acc,
                          [riskLevel]: currentRiskLevelParams,
                        }),
                        riskLevelParametersField.value,
                      );
                    }
                    if (currentRiskLevelActions && riskLevelActionsField.value) {
                      newActions = riskLevels.reduce<RiskLevelRuleActions>(
                        (acc, riskLevel) => ({
                          ...acc,
                          [riskLevel]: currentRiskLevelActions,
                        }),
                        riskLevelActionsField.value,
                      );
                    }

                    formState.setValues({
                      ...formState.values,
                      ...(newParams && { riskLevelParameters: newParams }),
                      ...(newActions && { riskLevelActions: newActions }),
                    });
                  }}
                />
              </PropertyListLayout>
            </Tabs.TabPane>
          );
        })}
      </Tabs>
    </>
  );
}

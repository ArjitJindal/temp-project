import { capitalize, toLower } from 'lodash';
import { useMemo } from 'react';
import s from './style.module.less';
import { AdvancedOptions } from './AdvancedOptions';
import {
  RiskLevelRuleActions,
  RiskLevelRuleParameters,
  RiskLevelsTriggersOnHit,
  Rule,
  RuleAction,
  TriggersOnHit,
} from '@/apis';

import JsonSchemaEditor from '@/components/library/JsonSchemaEditor';
import StepHeader from '@/pages/rules/RuleConfiguration/RuleConfigurationV2/StepHeader';
import { RISK_LEVELS } from '@/utils/risk-levels';
import { getRiskLevelLabel, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import RuleActionSelector from '@/pages/rules/RuleConfiguration/RuleConfigurationV2/steps/RuleParametersStep/RuleActionSelector';
import { PropertyListLayout } from '@/components/library/JsonSchemaEditor/PropertyList';
import NestedForm from '@/components/library/Form/NestedForm';
import InputField from '@/components/library/Form/InputField';
import { useFieldState, useFormState } from '@/components/library/Form/utils/hooks';
import ApplyRiskLevels from '@/pages/rules/RuleConfiguration/RuleConfigurationV2/steps/RuleParametersStep/ApplyRiskLevels';
import Tabs, { TabItem } from '@/components/library/Tabs';

export interface FormValues {
  ruleParameters?: unknown;
  ruleAction?: RuleAction;
  riskLevelParameters?: RiskLevelRuleParameters;
  riskLevelActions?: RiskLevelRuleActions;
  triggersOnHit?: TriggersOnHit;
  riskLevelsTriggersOnHit?: RiskLevelsTriggersOnHit;
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
      {activeTab === 'rule_specific_parameters' && <RuleSpecificParameters {...props} />}
      {activeTab === 'risk_based_thresholds' && <RiskBasedThresholds {...props} />}
    </>
  );
}

function RuleSpecificParameters(props: Props) {
  const { rule } = props;

  return (
    <>
      <StepHeader
        title={'Rule-specific parameters'}
        description={'Configure parameters that are specific for this rule'}
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
        <AdvancedOptions ruleType={rule.type} />
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
  const riskLevelsTriggersOnHitField = useFieldState<FormValues, 'riskLevelsTriggersOnHit'>(
    'riskLevelsTriggersOnHit',
  );

  const tabItems: TabItem[] = useMemo(() => {
    return RISK_LEVELS.map((riskLevel) => {
      const tabItem: TabItem = {
        title: (
          <div className={s.riskLevelTabLabel}>
            {capitalize(getRiskLevelLabel(riskLevel, settings))}
          </div>
        ),
        key: riskLevel,
        children: (
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
            <AdvancedOptions riskLevel={riskLevel} ruleType={rule.type} />
            <ApplyRiskLevels
              defaultInitialValues={defaultInitialValues.riskLevelParameters}
              currentRiskLevel={riskLevel}
              formValues={formState.values}
              onConfirm={(riskLevels) => {
                const currentRiskLevelParams = riskLevelParametersField?.value?.[riskLevel];
                const currentRiskLevelActions = riskLevelActionsField?.value?.[riskLevel];
                const currentRiskLevelTriggersOnHit =
                  riskLevelsTriggersOnHitField?.value?.[riskLevel];
                let newParams: RiskLevelRuleParameters | undefined = undefined;
                let newActions: RiskLevelRuleActions | undefined = undefined;
                let newTriggersOnHit: RiskLevelsTriggersOnHit | undefined = undefined;
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
                if (currentRiskLevelTriggersOnHit && riskLevelsTriggersOnHitField.value) {
                  newTriggersOnHit = riskLevels.reduce<RiskLevelsTriggersOnHit>(
                    (acc, riskLevel) => ({
                      ...acc,
                      [riskLevel]: currentRiskLevelTriggersOnHit,
                    }),
                    riskLevelsTriggersOnHitField.value,
                  );
                }

                formState.setValues({
                  ...formState.values,
                  ...(newParams && { riskLevelParameters: newParams }),
                  ...(newActions && { riskLevelActions: newActions }),
                  ...(newTriggersOnHit && { riskLevelsTriggersOnHit: newTriggersOnHit }),
                });
              }}
            />
          </PropertyListLayout>
        ),
      };
      return tabItem;
    });
  }, [
    riskLevelParametersField,
    riskLevelActionsField,
    riskLevelsTriggersOnHitField,
    formState,
    rule.parametersSchema,
    settings,
    defaultInitialValues.riskLevelParameters,
    rule.type,
  ]);

  return (
    <>
      <StepHeader
        title={'Risk-based thresholds'}
        description={'Configure risk-based thresholds that are specific for this rule'}
        tooltip={
          'Rules utilize CRA risk levels and they are automatically adjusted for manual overrides.'
        }
      />
      <Tabs items={tabItems} />
    </>
  );
}

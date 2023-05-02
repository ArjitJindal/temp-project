import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { EditOutlined } from '@ant-design/icons';
import s from './style.module.less';
import TransactionIcon from './transaction-icon.react.svg';
import { message } from '@/components/library/Message';
import Button from '@/components/library/Button';
import BasicDetailsStep, {
  FormValues as BasicDetailsStepFormValues,
  INITIAL_VALUES as BASIC_DETAILS_STEP_INITIAL_VALUES,
} from '@/pages/rules/RuleConfigurationDrawer/steps/BasicDetailsStep';
import RuleParametersStep, {
  FormValues as RuleParametersStepFormValues,
  INITIAL_VALUES as RULE_PARAMETERS_STEP_INITIAL_VALUES,
} from '@/pages/rules/RuleConfigurationDrawer/steps/RuleParametersStep';
import { Rule } from '@/apis';
import Stepper from '@/components/library/Stepper';
import Drawer from '@/components/library/Drawer';
import StandardFiltersStep, {
  FormValues as StandardFiltersStepFormValues,
  INITIAL_VALUES as STANDARD_FILTERS_STEP_INITIAL_VALUES,
} from '@/pages/rules/RuleConfigurationDrawer/steps/StandardFiltersStep';
import VerticalMenu from '@/components/library/VerticalMenu';
import Form from '@/components/library/Form';
import { useId } from '@/utils/hooks';
import NestedForm from '@/components/library/Form/NestedForm';
import HistoryLineIcon from '@/components/ui/icons/Remix/system/history-line.react.svg';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { validateField } from '@/components/library/Form/utils/validation/utils';
import {
  getOrderedProps,
  makeDefaultState,
  makeValidators,
} from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/utils';
import User3LineIcon from '@/components/ui/icons/Remix/user/user-3-line.react.svg';
import EarthLineIcon from '@/components/ui/icons/Remix/map/earth-line.react.svg';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import StepButtons from '@/components/library/StepButtons';
import { ChangeJsonSchemaEditorSettings } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/settings';

const BASIC_DETAILS_STEP = 'basic_details';
const STANDARD_FILTERS_STEP = 'standard_filters';
const RULE_PARAMETERS_STEP = 'rule_parameters';

export interface FormValues {
  basicDetailsStep: BasicDetailsStepFormValues;
  standardFiltersStep: StandardFiltersStepFormValues;
  ruleParametersStep: RuleParametersStepFormValues;
}

interface RuleConfigurationDrawerProps {
  rule: Rule | null;
  isVisible: boolean;
  isSubmitting: boolean;
  formInitialValues?: Partial<FormValues>;
  onChangeVisibility: (isVisible: boolean) => void;
  onSubmit: (formValues: FormValues) => void;
  readOnly?: boolean;
  isClickAwayEnabled?: boolean;
  changeToEditMode?: () => void;
  type: 'EDIT' | 'CREATE';
}

export default function RuleConfigurationDrawer(props: RuleConfigurationDrawerProps) {
  const {
    isVisible,
    isSubmitting,
    formInitialValues,
    onChangeVisibility,
    rule,
    onSubmit,
    readOnly = false,
  } = props;
  const isPulseEnabled = useFeatureEnabled('PULSE');

  const defaultInitialValues = useDefaultInitialValues(rule);

  const orderedProps = getOrderedProps(rule?.parametersSchema);

  let initialValues: FormValues;
  if (formInitialValues != null) {
    initialValues = {
      basicDetailsStep: BASIC_DETAILS_STEP_INITIAL_VALUES,
      standardFiltersStep: STANDARD_FILTERS_STEP_INITIAL_VALUES,
      ruleParametersStep: RULE_PARAMETERS_STEP_INITIAL_VALUES,
      ...formInitialValues,
    };
  } else {
    initialValues = defaultInitialValues;
  }

  const [activeStepKey, setActiveStepKey] = useState(BASIC_DETAILS_STEP);
  const [activeTabKey, setActiveTabKey] = useState('rule_details');
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setActiveStepKey(BASIC_DETAILS_STEP);
      setActiveTabKey('rule_details');
      setAlwaysShowErrors(false);
    }
  }, [isVisible]);

  const formId = useId(`form-`);

  const ruleParametersValidators = makeValidators(orderedProps);
  const fieldValidators = useMemo(() => {
    return {
      basicDetailsStep: {},
      standardFiltersStep: {},
      ruleParametersStep: {
        riskLevelActions: isPulseEnabled
          ? {
              VERY_HIGH: notEmpty,
              HIGH: notEmpty,
              MEDIUM: notEmpty,
              LOW: notEmpty,
              VERY_LOW: notEmpty,
            }
          : undefined,
        ruleAction: isPulseEnabled ? undefined : notEmpty,
        ruleParameters: isPulseEnabled ? undefined : ruleParametersValidators,
        riskLevelParameters: isPulseEnabled
          ? {
              VERY_HIGH: ruleParametersValidators,
              HIGH: ruleParametersValidators,
              MEDIUM: ruleParametersValidators,
              LOW: ruleParametersValidators,
              VERY_LOW: ruleParametersValidators,
            }
          : undefined,
      },
    };
  }, [isPulseEnabled, ruleParametersValidators]);
  const [formState, setFormState] = useState<FormValues>(initialValues);

  const STEPS = useMemo(
    () => [
      {
        key: BASIC_DETAILS_STEP,
        title: 'Basic details',
        isUnfilled:
          validateField(fieldValidators.basicDetailsStep, formState?.basicDetailsStep) != null,
        description: 'Configure the basic details for this rule',
        tabs: [{ key: 'rule_details', title: 'Rule details' }],
      },
      {
        key: STANDARD_FILTERS_STEP,
        title: 'Standard filters',
        isOptional: true,
        isUnfilled:
          validateField(fieldValidators.standardFiltersStep, formState?.standardFiltersStep) !=
          null,
        description: 'Configure filters that are common for all the rules',
        tabs: [
          { key: 'user_details', icon: <User3LineIcon />, title: 'User details' },
          { key: 'geography_details', icon: <EarthLineIcon />, title: 'Geography details' },
          ...(rule?.type === 'TRANSACTION'
            ? [
                {
                  key: 'transaction_details',
                  icon: <TransactionIcon />,
                  title: 'Transaction details',
                },
                {
                  key: 'transaction_details_historical',
                  icon: <HistoryLineIcon />,
                  title: 'Historical transactions',
                },
              ]
            : []),
        ],
      },
      {
        key: RULE_PARAMETERS_STEP,
        title: 'Rule parameters',
        isUnfilled:
          validateField(fieldValidators.ruleParametersStep, formState?.ruleParametersStep) != null,
        description: 'Configure filters & risk thresholds that are specific for this rule',
        tabs: isPulseEnabled
          ? [{ key: 'risk_based_thresholds', title: 'Risk-based thresholds' }]
          : [{ key: 'rule_specific_filters', title: 'Rule-specific filters' }],
      },
    ],
    [
      fieldValidators.basicDetailsStep,
      fieldValidators.standardFiltersStep,
      fieldValidators.ruleParametersStep,
      formState?.basicDetailsStep,
      formState?.standardFiltersStep,
      formState?.ruleParametersStep,
      rule?.type,
      isPulseEnabled,
    ],
  );

  const activeStepIndex = STEPS.findIndex(({ key }) => key === activeStepKey);

  const handleSubmit = (formValues: FormValues, { isValid }: { isValid: boolean }) => {
    if (isValid) {
      onSubmit(formValues);
    } else {
      message.warn('Please, make sure that all required fields are filled and values are valid!');
      setAlwaysShowErrors(true);
    }
  };

  const handleStepChange = useCallback(
    (stepKey: string) => {
      setActiveStepKey(stepKey);
      setActiveTabKey(STEPS.find(({ key }) => key === stepKey)?.tabs[0]?.key || '');
    },
    [STEPS, setActiveStepKey, setActiveTabKey],
  );

  return (
    <Form<FormValues>
      key={`${isVisible}`}
      id={formId}
      initialValues={initialValues}
      onSubmit={handleSubmit}
      className={s.root}
      fieldValidators={fieldValidators}
      alwaysShowErrors={alwaysShowErrors}
      onChange={({ values }) => {
        setFormState(values);
      }}
    >
      <Drawer
        isVisible={isVisible}
        onChangeVisibility={onChangeVisibility}
        title={
          props.type === 'EDIT'
            ? `${rule?.id} (${formInitialValues?.basicDetailsStep?.ruleInstanceId})`
            : 'Configure rule'
        }
        description={
          readOnly
            ? props.type === 'EDIT'
              ? `View the configured parameters of the rule. Click on ‘Edit’ to update the paramerters.`
              : 'Read all relevant rule information'
            : props.type === 'EDIT'
            ? `Edit the parameters of the rule. Click on ‘Save’ to update the rule`
            : 'Add all relevant information to configure this rule'
        }
        isClickAwayEnabled={props.isClickAwayEnabled}
        footer={
          <div className={s.footer}>
            <StepButtons
              nextDisabled={activeStepIndex >= STEPS.length - 1}
              prevDisabled={activeStepIndex === 0}
              onNext={() => {
                const nextStep = STEPS[activeStepIndex + 1];
                setActiveStepKey(nextStep?.key);
                setActiveTabKey(nextStep?.tabs[0]?.key);
              }}
              onPrevious={() => {
                const prevStep = STEPS[activeStepIndex - 1];
                setActiveStepKey(prevStep?.key);
                setActiveTabKey(prevStep?.tabs[0]?.key);
              }}
            />
            <div className={s.footerButtons}>
              <Button type="TETRIARY" onClick={() => onChangeVisibility(false)}>
                Cancel
              </Button>
              {!readOnly || props.type === 'CREATE' ? (
                <SubmitButton formId={formId} isSubmitting={isSubmitting} isDisabled={readOnly}>
                  {props.type === 'CREATE' ? 'Done' : 'Save'}
                </SubmitButton>
              ) : (
                <Button
                  type="SECONDARY"
                  onClick={() => {
                    if (props.changeToEditMode) {
                      props.changeToEditMode();
                    }
                  }}
                  icon={<EditOutlined />}
                >
                  Edit
                </Button>
              )}
            </div>
          </div>
        }
      >
        <Stepper steps={STEPS} active={activeStepKey} onChange={handleStepChange}>
          {(activeStepKey) => {
            const activeStep = STEPS.find(({ key }) => key === activeStepKey);
            const items = activeStep?.tabs ?? [];
            if (rule == null) {
              return;
            }
            return (
              <VerticalMenu
                items={items}
                active={activeTabKey}
                onChange={setActiveTabKey}
                minWidth={200}
              >
                <div className={readOnly ? s.readOnlyScrollContainer : s.scrollContainer}>
                  <div className={s.tabContent}>
                    <ChangeJsonSchemaEditorSettings
                      settings={{ showOptionalMark: !activeStep?.isOptional }}
                    >
                      {activeStepKey === BASIC_DETAILS_STEP && (
                        <div className={readOnly ? s.readOnlyFormContent : ''}>
                          <NestedForm<FormValues> name={'basicDetailsStep'}>
                            <BasicDetailsStep activeTab={activeTabKey} rule={rule} />
                          </NestedForm>
                        </div>
                      )}
                      {activeStepKey === STANDARD_FILTERS_STEP && (
                        <div className={readOnly ? s.readOnlyFormContent : ''}>
                          <NestedForm<FormValues> name={'standardFiltersStep'}>
                            <StandardFiltersStep
                              activeTab={activeTabKey}
                              rule={rule}
                              standardFilters={formState?.standardFiltersStep}
                              setFormValues={setFormState}
                            />
                          </NestedForm>
                        </div>
                      )}
                      {activeStepKey === RULE_PARAMETERS_STEP && (
                        <div className={readOnly ? s.readOnlyFormContent : ''}>
                          <NestedForm<FormValues> name={'ruleParametersStep'}>
                            <RuleParametersStep
                              activeTab={activeTabKey}
                              rule={rule}
                              defaultInitialValues={defaultInitialValues.ruleParametersStep}
                            />
                          </NestedForm>
                        </div>
                      )}
                    </ChangeJsonSchemaEditorSettings>
                  </div>
                </div>
              </VerticalMenu>
            );
          }}
        </Stepper>
      </Drawer>
    </Form>
  );
}

function SubmitButton(props: {
  formId: string;
  isSubmitting: boolean;
  isDisabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      htmlAttrs={{ form: props.formId }}
      htmlType="submit"
      isLoading={props.isSubmitting}
      isDisabled={props.isDisabled}
    >
      {props.children}
    </Button>
  );
}

function useDefaultInitialValues(rule: Rule | null) {
  const isPulseEnabled = useFeatureEnabled('PULSE');

  return useMemo(() => {
    const orderedProps = getOrderedProps(rule?.parametersSchema);

    const ruleParametersDefaultState = makeDefaultState(orderedProps);
    const ruleParametersStep = {
      ...RULE_PARAMETERS_STEP_INITIAL_VALUES,
    };
    if (isPulseEnabled) {
      ruleParametersStep.riskLevelParameters = rule?.defaultRiskLevelParameters ?? {
        VERY_HIGH: rule?.defaultParameters ?? ruleParametersDefaultState,
        HIGH: rule?.defaultParameters ?? ruleParametersDefaultState,
        MEDIUM: rule?.defaultParameters ?? ruleParametersDefaultState,
        LOW: rule?.defaultParameters ?? ruleParametersDefaultState,
        VERY_LOW: rule?.defaultParameters ?? ruleParametersDefaultState,
      };
      ruleParametersStep.riskLevelActions = rule?.defaultRiskLevelActions ?? {
        VERY_HIGH: 'FLAG',
        HIGH: 'FLAG',
        MEDIUM: 'FLAG',
        LOW: 'FLAG',
        VERY_LOW: 'FLAG',
      };
    } else {
      ruleParametersStep.ruleAction =
        rule?.defaultAction ?? RULE_PARAMETERS_STEP_INITIAL_VALUES.ruleAction;
      ruleParametersStep.ruleParameters =
        rule?.defaultParameters ?? RULE_PARAMETERS_STEP_INITIAL_VALUES.ruleParameters;
    }
    return {
      basicDetailsStep: {
        ruleName: rule?.name,
        ruleDescription: rule?.description,
        ruleNature: rule?.defaultNature ?? BASIC_DETAILS_STEP_INITIAL_VALUES.ruleNature,
        casePriority: rule?.defaultCasePriority ?? BASIC_DETAILS_STEP_INITIAL_VALUES.casePriority,
        ruleLabels: rule?.labels ?? BASIC_DETAILS_STEP_INITIAL_VALUES.ruleLabels,
      },
      standardFiltersStep: rule?.defaultFilters ?? STANDARD_FILTERS_STEP_INITIAL_VALUES,
      ruleParametersStep: ruleParametersStep,
    };
  }, [
    isPulseEnabled,
    rule?.defaultAction,
    rule?.defaultCasePriority,
    rule?.defaultFilters,
    rule?.defaultNature,
    rule?.defaultParameters,
    rule?.defaultRiskLevelActions,
    rule?.defaultRiskLevelParameters,
    rule?.description,
    rule?.name,
    rule?.parametersSchema,
    rule?.labels,
  ]);
}

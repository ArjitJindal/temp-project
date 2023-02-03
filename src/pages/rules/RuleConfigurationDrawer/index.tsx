import React, { useEffect, useState } from 'react';
import { message } from 'antd';
import s from './style.module.less';
import TransactionIcon from './transaction-icon.react.svg';
import Button from '@/components/ui/Button';
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
import ButtonGroup from '@/components/library/ButtonGroup';
import StandardFiltersStep, {
  FormValues as StandardFiltersStepFormValues,
  INITIAL_VALUES as STANDARD_FILTERS_STEP_INITIAL_VALUES,
} from '@/pages/rules/RuleConfigurationDrawer/steps/StandardFiltersStep';
import VerticalMenu from '@/components/library/VerticalMenu';
import Form from '@/components/library/Form';
import { useId } from '@/utils/hooks';
import NestedForm from '@/components/library/Form/NestedForm';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { validateField } from '@/components/library/Form/utils/validation/utils';
import { FieldValidators } from '@/components/library/Form/utils/validation/types';
import {
  getOrderedProps,
  makeDefaultState,
  makeValidators,
} from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/utils';
import User3LineIcon from '@/components/ui/icons/Remix/user/user-3-line.react.svg';
import EarthLineIcon from '@/components/ui/icons/Remix/map/earth-line.react.svg';
import { useFeaturesEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

const BASIC_DETAILS_STEP = 'basic_details';
const STANDARD_FILTERS_STEP = 'standard_filters';
const RULE_PARAMETERS_STEP = 'rule_parameters';

export interface FormValues {
  basicDetailsStep: BasicDetailsStepFormValues;
  standardFiltersStep: StandardFiltersStepFormValues;
  ruleParametersStep: RuleParametersStepFormValues;
}

const DEFAULT_INITIAL_VALUES: FormValues = {
  basicDetailsStep: BASIC_DETAILS_STEP_INITIAL_VALUES,
  standardFiltersStep: STANDARD_FILTERS_STEP_INITIAL_VALUES,
  ruleParametersStep: RULE_PARAMETERS_STEP_INITIAL_VALUES,
};

interface Props {
  rule: Rule | null;
  isVisible: boolean;
  isSubmitting: boolean;
  formInitialValues?: Partial<FormValues>;
  onChangeVisibility: (isVisible: boolean) => void;
  onSubmit: (formValues: FormValues) => void;
}

export default function RuleConfigurationDrawer(props: Props) {
  const { isVisible, isSubmitting, formInitialValues, onChangeVisibility, rule, onSubmit } = props;
  const isPulseEnabled = useFeaturesEnabled(['PULSE']);

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
    const ruleParametersDefaultState = makeDefaultState(orderedProps);
    const ruleParametersStep = {
      ...DEFAULT_INITIAL_VALUES.ruleParametersStep,
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
        rule?.defaultAction ?? DEFAULT_INITIAL_VALUES.ruleParametersStep.ruleAction;
      ruleParametersStep.ruleParameters =
        rule?.defaultParameters ?? DEFAULT_INITIAL_VALUES.ruleParametersStep.ruleParameters;
    }
    initialValues = {
      ...DEFAULT_INITIAL_VALUES,
      basicDetailsStep: {
        ruleName: rule?.name,
        ruleDescription: rule?.description,
        ruleNature: rule?.defaultNature ?? DEFAULT_INITIAL_VALUES.basicDetailsStep.ruleNature,
        casePriority:
          rule?.defaultCasePriority ?? DEFAULT_INITIAL_VALUES.basicDetailsStep.casePriority,
      },
      standardFiltersStep: rule?.defaultFilters ?? DEFAULT_INITIAL_VALUES.standardFiltersStep,
      ruleParametersStep: ruleParametersStep,
    };
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
  const fieldValidators: FieldValidators<FormValues> = {
    basicDetailsStep: {},
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

  const [formState, setFormState] = useState<FormValues>(initialValues);

  const STEPS = [
    {
      key: BASIC_DETAILS_STEP,
      title: 'Basic details',
      isUnfilled:
        validateField(fieldValidators.basicDetailsStep, formState?.basicDetailsStep) != null,
      description: 'Configure the basic details for this rule',
      tabs: [
        { key: 'rule_details', title: 'Rule details' },
        { key: 'case_creation_details', title: 'Case creation details' },
      ],
    },
    {
      key: STANDARD_FILTERS_STEP,
      title: 'Standard filters',
      isOptional: true,
      isUnfilled:
        validateField(fieldValidators.standardFiltersStep, formState?.standardFiltersStep) != null,
      description: 'Configure filters that are common for all the rules',
      tabs: [
        { key: 'user_details', icon: <User3LineIcon />, title: 'User details' },
        { key: 'geography_details', icon: <EarthLineIcon />, title: 'Geography details' },
        { key: 'transaction_details', icon: <TransactionIcon />, title: 'Transaction details' },
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
  ];

  const activeStepIndex = STEPS.findIndex(({ key }) => key === activeStepKey);

  const handleSubmit = (formValues: FormValues, { isValid }: { isValid: boolean }) => {
    if (isValid) {
      onSubmit(formValues);
    } else {
      message.warn('Please, make sure that all required fields are filled and values are valid!');
      setAlwaysShowErrors(true);
    }
  };

  return (
    <Drawer
      isVisible={isVisible}
      onChangeVisibility={onChangeVisibility}
      title="Configure rule"
      description="Add all relevant information to configure this rule"
      footer={
        <div className={s.footer}>
          <ButtonGroup
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
          <Button form={formId} htmlType="submit" loading={isSubmitting}>
            Done
          </Button>
        </div>
      }
    >
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
        <Stepper steps={STEPS} active={activeStepKey}>
          {(activeStepKey) => {
            const activeStep = STEPS.find(({ key }) => key === activeStepKey);
            const items = activeStep?.tabs ?? [];
            if (rule == null) {
              return <></>;
            }
            return (
              <VerticalMenu
                items={items}
                active={activeTabKey}
                onChange={setActiveTabKey}
                minWidth={200}
              >
                <div className={s.scrollContainer}>
                  <div className={s.tabContent}>
                    {activeStepKey === BASIC_DETAILS_STEP && (
                      <NestedForm<FormValues> name={'basicDetailsStep'}>
                        <BasicDetailsStep activeTab={activeTabKey} rule={rule} />
                      </NestedForm>
                    )}
                    {activeStepKey === STANDARD_FILTERS_STEP && (
                      <NestedForm<FormValues> name={'standardFiltersStep'}>
                        <StandardFiltersStep activeTab={activeTabKey} rule={rule} />
                      </NestedForm>
                    )}
                    {activeStepKey === RULE_PARAMETERS_STEP && (
                      <NestedForm<FormValues> name={'ruleParametersStep'}>
                        <RuleParametersStep activeTab={activeTabKey} rule={rule} />
                      </NestedForm>
                    )}
                  </div>
                </div>
              </VerticalMenu>
            );
          }}
        </Stepper>
      </Form>
    </Drawer>
  );
}

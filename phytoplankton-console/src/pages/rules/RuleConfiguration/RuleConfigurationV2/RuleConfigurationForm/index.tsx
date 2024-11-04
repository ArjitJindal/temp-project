import React, { useEffect, useMemo, useState } from 'react';
import { ConfigProvider } from 'antd';
import dayjs from '@flagright/lib/utils/dayjs';
import TransactionIcon from '../transaction-icon.react.svg';
import s from './style.module.less';
import { message } from '@/components/library/Message';
import BasicDetailsStep, {
  FormValues as BasicDetailsStepFormValues,
  INITIAL_VALUES as BASIC_DETAILS_STEP_INITIAL_VALUES,
} from '@/pages/rules/RuleConfiguration/RuleConfigurationV2/steps/BasicDetailsStep';
import RuleParametersStep, {
  FormValues as RuleParametersStepFormValues,
  INITIAL_VALUES as RULE_PARAMETERS_STEP_INITIAL_VALUES,
} from '@/pages/rules/RuleConfiguration/RuleConfigurationV2/steps/RuleParametersStep';
import { Rule } from '@/apis';
import Stepper from '@/components/library/Stepper';
import StandardFiltersStep, {
  FormValues as StandardFiltersStepFormValues,
  INITIAL_VALUES as STANDARD_FILTERS_STEP_INITIAL_VALUES,
} from '@/pages/rules/RuleConfiguration/RuleConfigurationV2/steps/StandardFiltersStep';
import VerticalMenu from '@/components/library/VerticalMenu';
import Form, { FormRef } from '@/components/library/Form';
import { useId, usePrevious } from '@/utils/hooks';
import NestedForm from '@/components/library/Form/NestedForm';
import HistoryLineIcon from '@/components/ui/icons/Remix/system/history-line.react.svg';
import SettingsLineIcon from '@/components/ui/icons/Remix/system/settings-3-line.react.svg';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { validateField } from '@/components/library/Form/utils/validation/utils';
import {
  makeDefaultState,
  makeValidators,
  useOrderedProps,
} from '@/components/library/JsonSchemaEditor/utils';
import User3LineIcon from '@/components/ui/icons/Remix/user/user-3-line.react.svg';
import EarthLineIcon from '@/components/ui/icons/Remix/map/earth-line.react.svg';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { ChangeJsonSchemaEditorSettings } from '@/components/library/JsonSchemaEditor/settings';
import { useJsonSchemaEditorContext } from '@/components/library/JsonSchemaEditor/context';
import * as Card from '@/components/ui/Card';

const BASIC_DETAILS_STEP = 'basic_details';
const STANDARD_FILTERS_STEP = 'standard_filters';
const RULE_PARAMETERS_STEP = 'rule_parameters';

export const RULE_CONFIGURATION_STEPS = [
  BASIC_DETAILS_STEP,
  STANDARD_FILTERS_STEP,
  RULE_PARAMETERS_STEP,
];

export interface RuleConfigurationFormValues {
  basicDetailsStep: BasicDetailsStepFormValues;
  standardFiltersStep: StandardFiltersStepFormValues;
  ruleParametersStep: RuleParametersStepFormValues;
}

interface RuleConfigurationFormProps {
  rule?: Rule | null;
  formInitialValues?: Partial<RuleConfigurationFormValues>;
  readOnly?: boolean;
  simulationMode?: boolean;
  showValidationError?: boolean;
  activeStepKey?: string;
  onActiveStepKeyChange: (key: string) => void;
  onSubmit: (formValues: RuleConfigurationFormValues) => void;
  setIsValuesSame?: (isSame: boolean) => void;
}

const ageFilterValidator = (value: any) => {
  if (value?.minAge == null || value?.maxAge == null) {
    return null;
  }
  if (value.minAge?.units === undefined && value.minAge?.granularity !== undefined) {
    return `Add number of ${value.minAge?.granularity}s in 'From' field `;
  }
  if (value.maxAge?.units === undefined && value.maxAge?.granularity !== undefined) {
    return `Add number of ${value.maxAge?.granularity}s in 'To' field`;
  }

  const minAgeInMs = dayjs
    .duration(value?.minAge?.units ?? 0, value?.minAge.granularity)
    .asMilliseconds();
  const maxAgeInMs = dayjs
    .duration(value?.maxAge?.units ?? Number.MAX_SAFE_INTEGER, value?.maxAge.granularity)
    .asMilliseconds();

  return minAgeInMs <= maxAgeInMs ? null : "'To' age should be greater than 'From' age";
};

const RuleConfigurationForm = (
  props: RuleConfigurationFormProps,
  ref: React.Ref<FormRef<RuleConfigurationFormValues>>,
) => {
  const {
    formInitialValues,
    rule,
    onSubmit,
    readOnly = false,
    simulationMode,
    showValidationError = false,
    activeStepKey = BASIC_DETAILS_STEP,
    onActiveStepKeyChange,
    setIsValuesSame,
  } = props;
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const defaultInitialValues = useDefaultInitialValues(rule);
  const orderedProps = useOrderedProps(rule?.parametersSchema);
  const initialValues: RuleConfigurationFormValues = formInitialValues
    ? {
        basicDetailsStep: BASIC_DETAILS_STEP_INITIAL_VALUES,
        standardFiltersStep: STANDARD_FILTERS_STEP_INITIAL_VALUES,
        ruleParametersStep: RULE_PARAMETERS_STEP_INITIAL_VALUES,
        ...formInitialValues,
      }
    : defaultInitialValues;

  const [activeTabKey, setActiveTabKey] = useState('rule_details');
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);

  const formId = useId(`form-`);
  const { rootSchema } = useJsonSchemaEditorContext();
  const ruleParametersValidators = makeValidators(orderedProps, rootSchema);
  const fieldValidators = useMemo(() => {
    return {
      basicDetailsStep: {},
      standardFiltersStep: {
        userAgeRange: ageFilterValidator,
        userCreationAgeRange: ageFilterValidator,
      },
      ruleParametersStep: {
        riskLevelActions: isRiskLevelsEnabled
          ? {
              VERY_HIGH: notEmpty,
              HIGH: notEmpty,
              MEDIUM: notEmpty,
              LOW: notEmpty,
              VERY_LOW: notEmpty,
            }
          : undefined,
        ruleAction: isRiskLevelsEnabled ? undefined : notEmpty,
        ruleParameters: isRiskLevelsEnabled ? undefined : ruleParametersValidators,
        riskLevelParameters: isRiskLevelsEnabled
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
  }, [isRiskLevelsEnabled, ruleParametersValidators]);
  const [formState, setFormState] = useState<RuleConfigurationFormValues>(initialValues);

  const isAlertCreationEnabled = useMemo(() => {
    return formState.basicDetailsStep.alertCreationOnHit;
  }, [formState.basicDetailsStep.alertCreationOnHit]);

  const STEPS = useMemo(
    () => [
      {
        key: BASIC_DETAILS_STEP,
        title: 'Basic details',
        isUnfilled:
          validateField(fieldValidators.basicDetailsStep, formState?.basicDetailsStep) != null,
        description: 'Configure the basic details for this rule',
        tabs: [
          ...(simulationMode ? [{ key: 'simulation_details', title: 'Simulation details' }] : []),
          { key: 'rule_details', title: 'Rule details' },
          ...(simulationMode ? [] : [{ key: 'checklist_details', title: 'Checklist details' }]),
          ...(isAlertCreationEnabled
            ? [{ key: 'alert_creation_details', title: 'Alert creation details' }]
            : []),
        ],
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
                {
                  key: 'general',
                  icon: <SettingsLineIcon />,
                  title: 'General',
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
        tabs: isRiskLevelsEnabled
          ? [{ key: 'risk_based_thresholds', title: 'Risk-based thresholds' }]
          : [{ key: 'rule_specific_parameters', title: 'Rule-specific parameters' }],
      },
    ],
    [
      fieldValidators.basicDetailsStep,
      fieldValidators.standardFiltersStep,
      fieldValidators.ruleParametersStep,
      formState?.basicDetailsStep,
      formState?.standardFiltersStep,
      formState?.ruleParametersStep,
      simulationMode,
      rule?.type,
      isRiskLevelsEnabled,
      isAlertCreationEnabled,
    ],
  );

  const prevActiveStepKey = usePrevious(activeStepKey);
  useEffect(() => {
    if (prevActiveStepKey !== activeStepKey) {
      setActiveTabKey(STEPS.find(({ key }) => key === activeStepKey)?.tabs[0]?.key || '');
    }
  }, [STEPS, activeStepKey, activeTabKey, prevActiveStepKey]);

  const handleSubmit = (
    formValues: RuleConfigurationFormValues,
    { isValid }: { isValid: boolean },
  ) => {
    if (isValid) {
      onSubmit(formValues);
    } else {
      message.warn('Please, make sure that all required fields are filled and values are valid!');
      setAlwaysShowErrors(true);
    }
  };

  return (
    <ConfigProvider getPopupContainer={(trigger: any) => trigger.parentElement}>
      <Form<RuleConfigurationFormValues>
        key={formId}
        id={formId}
        ref={ref}
        className={s.root}
        initialValues={initialValues}
        onSubmit={handleSubmit}
        fieldValidators={fieldValidators}
        alwaysShowErrors={alwaysShowErrors || showValidationError}
        onChange={({ values }) => {
          setFormState(values);
          setIsValuesSame?.(JSON.stringify(values) === JSON.stringify(initialValues)); // Is Equal was not working
        }}
      >
        <Stepper
          className={s.stepper}
          steps={STEPS}
          active={activeStepKey}
          onChange={onActiveStepKeyChange}
        >
          {(activeStepKey) => {
            const activeStep = STEPS.find(({ key }) => key === activeStepKey);
            const items = activeStep?.tabs ?? [];
            if (rule == null) {
              return;
            }
            return (
              <div className={s.menuWrapper}>
                <Card.Root className={s.menu}>
                  <Card.Section>
                    <VerticalMenu
                      items={items}
                      active={activeTabKey}
                      onChange={setActiveTabKey}
                      minWidth={200}
                    />
                  </Card.Section>
                </Card.Root>
                <Card.Root className={s.menuContent}>
                  <Card.Section>
                    <div className={readOnly ? s.readOnlyScrollContainer : s.scrollContainer}>
                      <div className={s.tabContent}>
                        <ChangeJsonSchemaEditorSettings
                          settings={{ showOptionalMark: !activeStep?.isOptional }}
                        >
                          {activeStepKey === BASIC_DETAILS_STEP && (
                            <div className={readOnly ? s.readOnlyFormContent : ''}>
                              <NestedForm<RuleConfigurationFormValues> name={'basicDetailsStep'}>
                                <BasicDetailsStep activeTab={activeTabKey} rule={rule} />
                              </NestedForm>
                            </div>
                          )}
                          {activeStepKey === STANDARD_FILTERS_STEP && (
                            <div className={readOnly ? s.readOnlyFormContent : ''}>
                              <NestedForm<RuleConfigurationFormValues> name={'standardFiltersStep'}>
                                <StandardFiltersStep
                                  activeTab={activeTabKey}
                                  rule={rule}
                                  standardFilters={formState?.standardFiltersStep}
                                />
                              </NestedForm>
                            </div>
                          )}
                          {activeStepKey === RULE_PARAMETERS_STEP && (
                            <div className={readOnly ? s.readOnlyFormContent : ''}>
                              <NestedForm<RuleConfigurationFormValues> name={'ruleParametersStep'}>
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
                  </Card.Section>
                </Card.Root>
              </div>
            );
          }}
        </Stepper>
      </Form>
    </ConfigProvider>
  );
};

export default React.forwardRef(RuleConfigurationForm);

function useDefaultInitialValues(rule: Rule | undefined | null) {
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const orderedProps = useOrderedProps(rule?.parametersSchema);

  return useMemo(() => {
    const ruleParametersDefaultState = makeDefaultState(orderedProps);
    const ruleParametersStep = {
      ...RULE_PARAMETERS_STEP_INITIAL_VALUES,
    };
    if (isRiskLevelsEnabled) {
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
        falsePositiveCheckEnabled: rule?.defaultFalsePositiveCheckEnabled ?? false,
        checksFor: rule?.checksFor ?? BASIC_DETAILS_STEP_INITIAL_VALUES.checksFor,
        frozenStatuses: BASIC_DETAILS_STEP_INITIAL_VALUES.frozenStatuses,
        alertCreatedFor: BASIC_DETAILS_STEP_INITIAL_VALUES.alertCreatedFor,
        ruleExecutionMode: BASIC_DETAILS_STEP_INITIAL_VALUES.ruleExecutionMode,
      },
      standardFiltersStep: rule?.defaultFilters ?? STANDARD_FILTERS_STEP_INITIAL_VALUES,
      ruleParametersStep: ruleParametersStep,
    };
  }, [
    orderedProps,
    isRiskLevelsEnabled,
    rule?.name,
    rule?.description,
    rule?.defaultNature,
    rule?.defaultCasePriority,
    rule?.labels,
    rule?.defaultFalsePositiveCheckEnabled,
    rule?.checksFor,
    rule?.defaultFilters,
    rule?.defaultRiskLevelParameters,
    rule?.defaultParameters,
    rule?.defaultRiskLevelActions,
    rule?.defaultAction,
  ]);
}

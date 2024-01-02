import React, { useMemo, useState } from 'react';
import { ConfigProvider } from 'antd';
import s from './style.module.less';
import BasicDetailsStep, {
  FormValues as BasicDetailsStepFormValues,
  INITIAL_VALUES as BASIC_DETAILS_STEP_INITIAL_VALUES,
} from './steps/BasicDetailsStep';
import RuleIsHitWhenStep, {
  FormValues as RuleIsHitWhenStepFormValues,
  INITIAL_VALUES as RULE_IS_HIT_WHEN_STEP_INITIAL_VALUES,
} from './steps/RuleIsHitWhenStep';
import RuleIsRunWhenStep, {
  FormValues as RuleIsRunWhenStepFormValues,
  INITIAL_VALUES as RULE_IS_RUN_WHEN_STEP_STEP_INITIAL_VALUES,
} from './steps/RuleIsRunWhenStep';
import AlertCreationDetailsStep, {
  FormValues as AlertCreationDetailsStepFormValues,
  INITIAL_VALUES as ALERT_CREATION_DETAILS_STEP_STEP_STEP_INITIAL_VALUES,
} from './steps/AlertCreationDetailsStep';

import { Rule } from '@/apis';
import Stepper from '@/components/library/Stepper';
import Form, { FormRef } from '@/components/library/Form';
import { useId } from '@/utils/hooks';
import NestedForm from '@/components/library/Form/NestedForm';
import { validateField } from '@/components/library/Form/utils/validation/utils';
import { message } from '@/components/library/Message';

const BASIC_DETAILS_STEP = 'basicDetailsStep';
const RULE_IS_HIT_WHEN_STEP = 'ruleIsHitWhenStep';
const RULE_IS_RUN_WHEN_STEP = 'ruleIsRunWhenStep';
const ALERT_CREATION_DETAILS_STEP = 'alertCreationDetailsStep';

export const STEPS = [
  BASIC_DETAILS_STEP,
  RULE_IS_HIT_WHEN_STEP,
  RULE_IS_RUN_WHEN_STEP,
  ALERT_CREATION_DETAILS_STEP,
];

export interface ScenarioConfigurationFormValues {
  basicDetailsStep: BasicDetailsStepFormValues;
  ruleIsHitWhenStep: RuleIsHitWhenStepFormValues;
  ruleIsRunWhenStep: RuleIsRunWhenStepFormValues;
  alertCreationDetailsStep: AlertCreationDetailsStepFormValues;
}

interface RuleConfigurationFormProps {
  rule?: Rule | null;
  formInitialValues?: Partial<ScenarioConfigurationFormValues>;
  readOnly?: boolean;
  simulationMode?: boolean;
  showValidationError?: boolean;
  activeStepKey?: string;
  onActiveStepKeyChange: (key: string) => void;
  onSubmit: (formValues: ScenarioConfigurationFormValues) => void;
  setIsValuesSame?: (isSame: boolean) => void;
}

function ScenarioConfigurationForm(
  props: RuleConfigurationFormProps,
  ref: React.Ref<FormRef<ScenarioConfigurationFormValues>>,
) {
  const {
    formInitialValues,
    rule,
    onSubmit,
    readOnly = false,
    showValidationError = false,
    activeStepKey = BASIC_DETAILS_STEP,
    onActiveStepKeyChange,
    setIsValuesSame,
  } = props;
  // const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const defaultInitialValues = useDefaultInitialValues(rule);
  // const orderedProps = useOrderedProps(rule?.parametersSchema);
  const initialValues: ScenarioConfigurationFormValues = formInitialValues
    ? {
        ...defaultInitialValues,
        ...formInitialValues,
      }
    : defaultInitialValues;
  // const [activeTabKey, setActiveTabKey] = useState('rule_details');
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);

  const formId = useId(`form-`);
  // const { rootSchema } = useJsonSchemaEditorContext();
  // const ruleParametersValidators = makeValidators(orderedProps, rootSchema);
  const fieldValidators = useMemo(() => {
    return {};
    // return {
    //   basicDetailsStep: {},
    //   standardFiltersStep: {},
    //   ruleParametersStep: {
    //     riskLevelActions: isRiskLevelsEnabled
    //       ? {
    //           VERY_HIGH: notEmpty,
    //           HIGH: notEmpty,
    //           MEDIUM: notEmpty,
    //           LOW: notEmpty,
    //           VERY_LOW: notEmpty,
    //         }
    //       : undefined,
    //     ruleAction: isRiskLevelsEnabled ? undefined : notEmpty,
    //     ruleParameters: isRiskLevelsEnabled ? undefined : ruleParametersValidators,
    //     riskLevelParameters: isRiskLevelsEnabled
    //       ? {
    //           VERY_HIGH: ruleParametersValidators,
    //           HIGH: ruleParametersValidators,
    //           MEDIUM: ruleParametersValidators,
    //           LOW: ruleParametersValidators,
    //           VERY_LOW: ruleParametersValidators,
    //         }
    //       : undefined,
    //   },
    // };
  }, []);

  const [formState, setFormState] = useState<ScenarioConfigurationFormValues>(initialValues);
  const STEPS = useMemo(
    () => [
      {
        key: BASIC_DETAILS_STEP,
        title: 'Basic details',
        isOptional: false,
        isUnfilled:
          validateField(fieldValidators[BASIC_DETAILS_STEP], formState?.[BASIC_DETAILS_STEP]) !=
          null,
        description: 'Define rule name and description based on the rule condition',
      },
      {
        key: RULE_IS_HIT_WHEN_STEP,
        title: 'Rule is hit when',
        isOptional: false,
        isUnfilled:
          validateField(
            fieldValidators[RULE_IS_HIT_WHEN_STEP],
            formState?.[RULE_IS_HIT_WHEN_STEP],
          ) != null,
        description: 'Define rule variables and condition for which the rule is hit',
      },
      {
        key: RULE_IS_RUN_WHEN_STEP,
        title: 'Rule is run when',
        isOptional: true,
        isUnfilled:
          validateField(
            fieldValidators[RULE_IS_RUN_WHEN_STEP],
            formState?.[RULE_IS_RUN_WHEN_STEP],
          ) != null,
        description: 'Define user and transaction filters for the rule to consider',
      },
      {
        key: ALERT_CREATION_DETAILS_STEP,
        title: 'Alert creation details',
        isOptional: false,
        isUnfilled:
          validateField(
            fieldValidators[ALERT_CREATION_DETAILS_STEP],
            formState?.[ALERT_CREATION_DETAILS_STEP],
          ) != null,
        description: 'Define alert creation details for the defined rule when hit',
      },
    ],
    [fieldValidators, formState],
  );

  const handleSubmit = (
    formValues: ScenarioConfigurationFormValues,
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
      <Form<ScenarioConfigurationFormValues>
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
          layout="VERTICAL"
          className={s.stepper}
          steps={STEPS}
          active={activeStepKey}
          onChange={onActiveStepKeyChange}
        >
          {(activeStepKey) => (
            <div className={props.readOnly ? s.readOnlyFormContent : ''}>
              <NestedForm<ScenarioConfigurationFormValues> name={activeStepKey}>
                <StepSubform activeStepKey={activeStepKey} readOnly={readOnly} />
              </NestedForm>
            </div>
          )}
        </Stepper>
      </Form>
    </ConfigProvider>
  );
}

function StepSubform(props: { activeStepKey: string; readOnly: boolean }) {
  const { activeStepKey } = props;
  if (activeStepKey === BASIC_DETAILS_STEP) {
    return <BasicDetailsStep />;
  }
  if (activeStepKey === RULE_IS_HIT_WHEN_STEP) {
    return <RuleIsHitWhenStep />;
  }
  if (activeStepKey === RULE_IS_RUN_WHEN_STEP) {
    return <RuleIsRunWhenStep />;
  }
  if (activeStepKey === ALERT_CREATION_DETAILS_STEP) {
    return <AlertCreationDetailsStep />;
  }
  return <></>;
}

export default React.forwardRef(ScenarioConfigurationForm);

function useDefaultInitialValues(_rule: Rule | undefined | null) {
  return {
    basicDetailsStep: BASIC_DETAILS_STEP_INITIAL_VALUES,
    ruleIsHitWhenStep: RULE_IS_HIT_WHEN_STEP_INITIAL_VALUES,
    ruleIsRunWhenStep: RULE_IS_RUN_WHEN_STEP_STEP_INITIAL_VALUES,
    alertCreationDetailsStep: ALERT_CREATION_DETAILS_STEP_STEP_STEP_INITIAL_VALUES,
  };
  // const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  // const orderedProps = useOrderedProps(rule?.parametersSchema);
  //
  // return useMemo(() => {
  //   const ruleParametersDefaultState = makeDefaultState(orderedProps);
  //   const ruleParametersStep = {
  //     ...RULE_PARAMETERS_STEP_INITIAL_VALUES,
  //   };
  //   if (isRiskLevelsEnabled) {
  //     ruleParametersStep.riskLevelParameters = rule?.defaultRiskLevelParameters ?? {
  //       VERY_HIGH: rule?.defaultParameters ?? ruleParametersDefaultState,
  //       HIGH: rule?.defaultParameters ?? ruleParametersDefaultState,
  //       MEDIUM: rule?.defaultParameters ?? ruleParametersDefaultState,
  //       LOW: rule?.defaultParameters ?? ruleParametersDefaultState,
  //       VERY_LOW: rule?.defaultParameters ?? ruleParametersDefaultState,
  //     };
  //     ruleParametersStep.riskLevelActions = rule?.defaultRiskLevelActions ?? {
  //       VERY_HIGH: 'FLAG',
  //       HIGH: 'FLAG',
  //       MEDIUM: 'FLAG',
  //       LOW: 'FLAG',
  //       VERY_LOW: 'FLAG',
  //     };
  //   } else {
  //     ruleParametersStep.ruleAction =
  //       rule?.defaultAction ?? RULE_PARAMETERS_STEP_INITIAL_VALUES.ruleAction;
  //     ruleParametersStep.ruleParameters =
  //       rule?.defaultParameters ?? RULE_PARAMETERS_STEP_INITIAL_VALUES.ruleParameters;
  //   }
  //   return {
  //     basicDetailsStep: {
  //       ruleName: rule?.name,
  //       ruleDescription: rule?.description,
  //       ruleNature: rule?.defaultNature ?? BASIC_DETAILS_STEP_INITIAL_VALUES.ruleNature,
  //       casePriority: rule?.defaultCasePriority ?? BASIC_DETAILS_STEP_INITIAL_VALUES.casePriority,
  //       ruleLabels: rule?.labels ?? BASIC_DETAILS_STEP_INITIAL_VALUES.ruleLabels,
  //       falsePositiveCheckEnabled: rule?.defaultFalsePositiveCheckEnabled ?? false,
  //       checksFor: rule?.checksFor ?? BASIC_DETAILS_STEP_INITIAL_VALUES.checksFor,
  //     },
  //     standardFiltersStep: rule?.defaultFilters ?? STANDARD_FILTERS_STEP_INITIAL_VALUES,
  //     ruleParametersStep: ruleParametersStep,
  //   };
  // }, [
  //   orderedProps,
  //   isRiskLevelsEnabled,
  //   rule?.name,
  //   rule?.description,
  //   rule?.defaultNature,
  //   rule?.defaultCasePriority,
  //   rule?.labels,
  //   rule?.defaultFilters,
  //   rule?.defaultRiskLevelParameters,
  //   rule?.defaultParameters,
  //   rule?.defaultRiskLevelActions,
  //   rule?.defaultAction,
  //   rule?.defaultFalsePositiveCheckEnabled,
  //   rule?.checksFor,
  // ]);
}

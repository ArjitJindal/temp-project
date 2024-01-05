import React, { useMemo, useState } from 'react';
import { ConfigProvider } from 'antd';
import s from './style.module.less';
import BasicDetailsStep, {
  FormValues as BasicDetailsStepFormValues,
  INITIAL_VALUES as BASIC_DETAILS_STEP_INITIAL_VALUES,
} from './steps/BasicDetailsStep';
import RuleIsHitWhenStep, {
  RuleIsHitWhenStepFormValues,
  INITIAL_VALUES as RULE_IS_HIT_WHEN_STEP_INITIAL_VALUES,
} from './steps/RuleIsHitWhenStep';
import RuleIsRunWhenStep, {
  FormValues as RuleIsRunWhenStepFormValues,
} from './steps/RuleIsRunWhenStep';
import AlertCreationDetailsStep, {
  FormValues as AlertCreationDetailsStepFormValues,
} from './steps/AlertCreationDetailsStep';

import { Rule } from '@/apis';
import Stepper from '@/components/library/Stepper';
import Form, { FormRef } from '@/components/library/Form';
import { useId } from '@/utils/hooks';
import NestedForm from '@/components/library/Form/NestedForm';
import { validateField } from '@/components/library/Form/utils/validation/utils';
import { message } from '@/components/library/Message';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

const BASIC_DETAILS_STEP = 'basicDetailsStep';
const RULE_IS_HIT_WHEN_STEP = 'ruleIsHitWhenStep';
const RULE_IS_RUN_WHEN_STEP = 'ruleIsRunWhenStep';
const ALERT_CREATION_DETAILS_STEP = 'alertCreationDetailsStep';

export const STEPS = [
  BASIC_DETAILS_STEP,
  RULE_IS_HIT_WHEN_STEP,
  // TODO: Uncomment when rule is run when step is implemented
  // RULE_IS_RUN_WHEN_STEP,
  ALERT_CREATION_DETAILS_STEP,
];

export interface RuleConfigurationFormV8Values {
  basicDetailsStep: BasicDetailsStepFormValues;
  ruleIsHitWhenStep: RuleIsHitWhenStepFormValues;
  ruleIsRunWhenStep: RuleIsRunWhenStepFormValues;
  alertCreationDetailsStep: AlertCreationDetailsStepFormValues;
}

interface RuleConfigurationFormProps {
  rule?: Rule | null;
  formInitialValues?: Partial<RuleConfigurationFormV8Values>;
  readOnly?: boolean;
  simulationMode?: boolean;
  showValidationError?: boolean;
  activeStepKey?: string;
  onActiveStepKeyChange: (key: string) => void;
  onSubmit: (formValues: RuleConfigurationFormV8Values) => void;
  setIsValuesSame?: (isSame: boolean) => void;
}

function RuleConfigurationFormV8(
  props: RuleConfigurationFormProps,
  ref: React.Ref<FormRef<RuleConfigurationFormV8Values>>,
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
  const defaultInitialValues = useDefaultInitialValues(rule);
  const initialValues: RuleConfigurationFormV8Values = formInitialValues
    ? {
        ...defaultInitialValues,
        ...formInitialValues,
      }
    : defaultInitialValues;
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);

  const formId = useId(`form-`);
  const fieldValidators = useMemo(() => {
    return {};
    // TODO (V8): Add validators for the form
    // return {
    //   basicDetailsStep: {},
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
    //     ruleLogic: isRiskLevelsEnabled ? undefined : notEmpty,
    //     riskLevelLogic: isRiskLevelsEnabled
    //       ? {
    //           VERY_HIGH: notEmpty,
    //           HIGH: notEmpty,
    //           MEDIUM: notEmpty,
    //           LOW: notEmpty,
    //           VERY_LOW: notEmpty,
    //         }
    //       : undefined,
    //   },
    // };
  }, []);

  const [formState, setFormState] = useState<RuleConfigurationFormV8Values>(initialValues);
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
      // TODO: Uncomment when rule is run when step is implemented
      // {
      //   key: RULE_IS_RUN_WHEN_STEP,
      //   title: 'Rule is run when',
      //   isOptional: true,
      //   isUnfilled:
      //     validateField(
      //       fieldValidators[RULE_IS_RUN_WHEN_STEP],
      //       formState?.[RULE_IS_RUN_WHEN_STEP],
      //     ) != null,
      //   description: 'Define user and transaction filters for the rule to consider',
      // },
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
    formValues: RuleConfigurationFormV8Values,
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
      <Form<RuleConfigurationFormV8Values>
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
              <NestedForm<RuleConfigurationFormV8Values> name={activeStepKey}>
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

export default React.forwardRef(RuleConfigurationFormV8);

function useDefaultInitialValues(rule: Rule | undefined | null): RuleConfigurationFormV8Values {
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  return useMemo(() => {
    const ruleIsHitWhenStep: RuleIsHitWhenStepFormValues = {
      ...RULE_IS_HIT_WHEN_STEP_INITIAL_VALUES,
      ruleLogicAggregationVariables: rule?.defaultLogicAggregationVariables ?? [],
    };
    if (isRiskLevelsEnabled) {
      ruleIsHitWhenStep.riskLevelRuleLogic = rule?.defaultRiskLevelLogic ?? {
        VERY_HIGH: rule?.defaultLogic,
        HIGH: rule?.defaultLogic,
        MEDIUM: rule?.defaultLogic,
        LOW: rule?.defaultLogic,
        VERY_LOW: rule?.defaultLogic,
      };
      ruleIsHitWhenStep.riskLevelRuleActions = rule?.defaultRiskLevelActions ?? {
        VERY_HIGH: 'FLAG',
        HIGH: 'FLAG',
        MEDIUM: 'FLAG',
        LOW: 'FLAG',
        VERY_LOW: 'FLAG',
      };
    } else {
      ruleIsHitWhenStep.ruleAction =
        rule?.defaultAction ?? RULE_IS_HIT_WHEN_STEP_INITIAL_VALUES.ruleAction;
    }
    return {
      basicDetailsStep: {
        ruleName: rule?.name,
        ruleDescription: rule?.description,
        ruleNature: rule?.defaultNature ?? BASIC_DETAILS_STEP_INITIAL_VALUES.ruleNature,
        ruleLabels: rule?.labels ?? BASIC_DETAILS_STEP_INITIAL_VALUES.ruleLabels,
      },
      ruleIsHitWhenStep,
      ruleIsRunWhenStep: {},
      alertCreationDetailsStep: {},
    };
  }, [
    isRiskLevelsEnabled,
    rule?.defaultAction,
    rule?.defaultLogic,
    rule?.defaultLogicAggregationVariables,
    rule?.defaultNature,
    rule?.defaultRiskLevelActions,
    rule?.defaultRiskLevelLogic,
    rule?.description,
    rule?.labels,
    rule?.name,
  ]);
}

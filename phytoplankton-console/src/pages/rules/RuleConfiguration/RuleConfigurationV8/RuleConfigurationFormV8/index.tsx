import React, { useMemo, useState, useEffect } from 'react';
import { ConfigProvider } from 'antd';
import cn from 'clsx';
import { getAllEntityVariables } from '../../../utils';
import s from './style.module.less';
import BasicDetailsStep, {
  FormValues as BasicDetailsStepFormValues,
  INITIAL_VALUES as BASIC_DETAILS_STEP_INITIAL_VALUES,
} from './steps/BasicDetailsStep';
import RuleIsHitWhenStep, {
  RuleIsHitWhenStepFormValues,
  INITIAL_VALUES as RULE_IS_HIT_WHEN_STEP_INITIAL_VALUES,
} from './steps/RuleIsHitWhenStep';
import AlertCreationDetailsStep, {
  FormValues as AlertCreationDetailsStepFormValues,
  INITIAL_VALUES as ALERT_CREATION_DETAILS_STEP_INITIAL_VALUES,
} from './steps/AlertCreationDetailsStep';
import * as Card from '@/components/ui/Card';

import { Rule } from '@/apis';
import { StepperSteps } from '@/components/library/Stepper';
import Form, { FormRef } from '@/components/library/Form';
import { useId } from '@/utils/hooks';
import { validateField } from '@/components/library/Form/utils/validation/utils';
import { message } from '@/components/library/Message';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { FieldValidators, isResultValid } from '@/components/library/Form/utils/validation/types';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { RISK_LEVELS } from '@/utils/risk-levels';
import NestedForm from '@/components/library/Form/NestedForm';
import NameAndDescription from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/NameAndDescription';
import ExpandContainer from '@/components/utils/ExpandContainer';

const BASIC_DETAILS_STEP = 'basicDetailsStep';
const RULE_IS_HIT_WHEN_STEP = 'ruleIsHitWhenStep';
const ALERT_CREATION_DETAILS_STEP = 'alertCreationDetailsStep';

export const STEPS = [BASIC_DETAILS_STEP, RULE_IS_HIT_WHEN_STEP, ALERT_CREATION_DETAILS_STEP];

export interface RuleConfigurationFormV8Values {
  basicDetailsStep: Partial<BasicDetailsStepFormValues>;
  ruleIsHitWhenStep: Partial<RuleIsHitWhenStepFormValues>;
  alertCreationDetailsStep: Partial<AlertCreationDetailsStepFormValues>;
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
  renderButtonsFooter?: () => React.ReactNode;
  newRuleId?: string;
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
    newRuleId,
    simulationMode,
  } = props;
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const defaultInitialValues = useDefaultInitialValues(rule);
  const initialValues: RuleConfigurationFormV8Values = formInitialValues
    ? {
        ...defaultInitialValues,
        ...formInitialValues,
      }
    : defaultInitialValues;
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);

  const formId = useId(`form-`);

  const [formState, setFormState] = useState<RuleConfigurationFormV8Values>(initialValues);

  const fieldValidators: FieldValidators<RuleConfigurationFormV8Values> = useMemo(() => {
    const alertCreationDetailsStep = formState?.alertCreationDetailsStep;
    return {
      basicDetailsStep: {
        ruleName: notEmpty,
        ruleDescription: notEmpty,
        ruleNature: notEmpty,
      },
      ruleIsHitWhenStep: {
        ruleLogic: isRiskLevelsEnabled ? undefined : notEmpty,
        riskLevelRuleLogic: isRiskLevelsEnabled
          ? (value) => {
              const emptyRiskLevels = RISK_LEVELS.filter((riskLevel) => {
                const valueElement = value?.[riskLevel];
                const result = notEmpty(valueElement);
                return !isResultValid(result);
              });
              if (emptyRiskLevels.length === 0) {
                return null;
              }
              return `Rule logic definition should be configured for all risk levels and cannot be empty.`;
            }
          : undefined,
      },
      alertCreationDetailsStep: {
        alertCreatedFor: notEmpty,
        alertAssignees: (value) => {
          return alertCreationDetailsStep?.alertAssigneesType === 'EMAIL' ? notEmpty(value) : null;
        },
        alertAssigneeRole: (value) => {
          return alertCreationDetailsStep?.alertAssigneesType === 'ROLE' ? notEmpty(value) : null;
        },
      },
    };
  }, [isRiskLevelsEnabled, formState?.alertCreationDetailsStep]);

  const STEPS = useMemo(
    () =>
      [
        {
          key: BASIC_DETAILS_STEP,
          title: 'Basic details',
          isOptional: false,
          description: 'Define rule name and description based on the rule condition',
        },
        {
          key: RULE_IS_HIT_WHEN_STEP,
          title: 'Rule is hit when',
          isOptional: false,
          description: 'Define rule variables and condition for which the rule is hit',
        },
        {
          key: ALERT_CREATION_DETAILS_STEP,
          title: 'Alert creation details',
          isOptional: false,
          description: 'Define alert creation details for the defined rule when hit',
        },
      ].map((step) => ({
        ...step,
        isInvalid:
          (showValidationError || alwaysShowErrors) &&
          validateField(fieldValidators?.[step.key], formState?.[step.key]) != null,
      })),
    [alwaysShowErrors, fieldValidators, formState, showValidationError],
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

  const { ruleName, ruleDescription } = formState.basicDetailsStep;
  const [showTopCard, setShowTopCard] = useState(false);
  const isRuleNameDefined = !!ruleName && !!ruleDescription;
  const isInitialNameDescriptionDefined =
    !!initialValues.basicDetailsStep.ruleName && !!initialValues.basicDetailsStep.ruleDescription;
  useEffect(() => {
    if (simulationMode) {
      return;
    }
    setShowTopCard(
      showTopCard ||
        (activeStepKey !== BASIC_DETAILS_STEP && isRuleNameDefined) ||
        isInitialNameDescriptionDefined,
    );
  }, [
    showTopCard,
    activeStepKey,
    isRuleNameDefined,
    isInitialNameDescriptionDefined,
    simulationMode,
  ]);

  return (
    <ConfigProvider
      getPopupContainer={(trigger: any) =>
        trigger === undefined ? document.body : trigger.parentElement
      }
    >
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
        <ExpandContainer isCollapsed={!showTopCard}>
          {isRuleNameDefined && (
            <NameAndDescription ruleName={ruleName} ruleDescription={ruleDescription} />
          )}
        </ExpandContainer>
        <div className={s.stepper}>
          <Card.Root className={s.steps}>
            <Card.Section>
              <StepperSteps
                layout="VERTICAL"
                steps={STEPS}
                active={activeStepKey}
                onChange={onActiveStepKeyChange}
              />
            </Card.Section>
          </Card.Root>
          <div className={cn(s.stepperContent)}>
            <div className={cn(props.readOnly ? s.readOnlyFormContent : '')}>
              <NestedForm<RuleConfigurationFormV8Values> name={activeStepKey}>
                <StepSubform
                  activeStepKey={activeStepKey}
                  readOnly={readOnly}
                  newRuleId={newRuleId}
                  simulationMode={simulationMode}
                />
              </NestedForm>
            </div>
          </div>
        </div>
      </Form>
    </ConfigProvider>
  );
}

function StepSubform(props: {
  activeStepKey: string;
  readOnly: boolean;
  newRuleId?: string;
  simulationMode?: boolean;
}) {
  const { activeStepKey, newRuleId, simulationMode } = props;
  if (activeStepKey === BASIC_DETAILS_STEP) {
    return <BasicDetailsStep newRuleId={newRuleId} simulationMode={simulationMode} />;
  }
  if (activeStepKey === RULE_IS_HIT_WHEN_STEP) {
    return <RuleIsHitWhenStep readOnly={props.readOnly} />;
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
      ruleLogic: rule?.defaultLogic,
      ruleLogicEntityVariables: getAllEntityVariables(rule?.defaultLogic),
      ruleLogicAggregationVariables: rule?.defaultLogicAggregationVariables ?? [],
      baseCurrency: rule?.defaultBaseCurrency,
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
      alertCreationDetailsStep: {
        alertCreatedFor: ALERT_CREATION_DETAILS_STEP_INITIAL_VALUES.alertCreatedFor,
        alertCreationInterval: ALERT_CREATION_DETAILS_STEP_INITIAL_VALUES.alertCreationInterval,
        alertPriority: ALERT_CREATION_DETAILS_STEP_INITIAL_VALUES.alertPriority,
        falsePositiveCheckEnabled:
          ALERT_CREATION_DETAILS_STEP_INITIAL_VALUES.falsePositiveCheckEnabled,
        frozenStatuses: ALERT_CREATION_DETAILS_STEP_INITIAL_VALUES.frozenStatuses,
      },
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
    rule?.defaultBaseCurrency,
  ]);
}

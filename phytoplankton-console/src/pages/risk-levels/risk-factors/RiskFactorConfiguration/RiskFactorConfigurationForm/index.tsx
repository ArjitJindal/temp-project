import { ConfigProvider } from 'antd';
import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import cn from 'clsx';
import { RiskFactorConfigurationFormValues } from '../utils';
import s from './style.module.less';
import { BasicDetailsStep } from './BasicDetailsStep';
import RiskFactorConfigurationStep from './RiskFactorConfigurationStep';
import Form, { FormRef } from '@/components/library/Form';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { FieldValidators } from '@/components/library/Form/utils/validation/types';
import { validateField } from '@/components/library/Form/utils/validation/utils';
import { useId } from '@/utils/hooks';
import * as Card from '@/components/ui/Card';
import { StepperSteps } from '@/components/library/Stepper';
import NestedForm from '@/components/library/Form/NestedForm';
import { RiskLevel } from '@/apis';
import { message } from '@/components/library/Message';
import ExpandContainer from '@/components/utils/ExpandContainer';
import NameAndDescription from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/NameAndDescription';
import { makeMetaFromChangedFields } from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/RiskFactorConfigurationForm/helpers';
import { DiffPath } from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/diff';

interface RiskFactorConfigurationFormProps {
  type: 'consumer' | 'business' | 'transaction';
  showValidationError?: boolean;
  activeStepKey?: string;
  readonly: boolean;
  onActiveStepChange: (key: string) => void;
  onSubmit: (formValues: RiskFactorConfigurationFormValues) => void;
  id?: string;
  formInitialValues?: RiskFactorConfigurationFormValues;
  newRiskId?: string;
  changedFields?: DiffPath[];
}

export const BASIC_DETAILS_STEP = 'basicDetailsStep';
export const RISK_FACTOR_CONFIGURATION_STEP = 'riskFactorConfigurationStep';
export const STEPS = [BASIC_DETAILS_STEP, RISK_FACTOR_CONFIGURATION_STEP];

function RiskFactorConfigurationForm(
  props: RiskFactorConfigurationFormProps,
  forwardedRef: React.Ref<any>,
) {
  const {
    id,
    showValidationError = false,
    type,
    activeStepKey = BASIC_DETAILS_STEP,
    readonly,
    onActiveStepChange,
    onSubmit,
    formInitialValues,
    newRiskId,
    changedFields,
  } = props;
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);
  const INITIAL_VALUES = useMemo(() => {
    if (formInitialValues) {
      return formInitialValues;
    }
    return {
      basicDetailsStep: {
        name: '',
        description: '',
        defaultRiskValue: 'HIGH' as RiskLevel,
        defaultWeight: 0.5,
      },
      riskFactorConfigurationStep: {},
    };
  }, [formInitialValues]);

  const formId = useId(`form-`);

  const [formState, setFormState] = useState<RiskFactorConfigurationFormValues>(INITIAL_VALUES);
  const [showTopCard, setShowTopCard] = useState(id != null);

  const isRiskFactorNameDefined =
    !!formState?.basicDetailsStep.name && !!formState?.basicDetailsStep.description;

  useEffect(() => {
    setShowTopCard(
      (showTopCard) =>
        showTopCard || (activeStepKey !== BASIC_DETAILS_STEP && isRiskFactorNameDefined),
    );
  }, [activeStepKey, isRiskFactorNameDefined]);

  const fieldValidators: FieldValidators<RiskFactorConfigurationFormValues> = useMemo(() => {
    return {
      basicDetailsStep: {
        name: notEmpty,
        description: notEmpty,
        defaultRiskValue: notEmpty,
        defaultWeight: notEmpty,
      },
      riskFactorConfigurationStep: {
        riskLevelLogic: notEmpty,
      },
    };
  }, []);
  const stepsWithValidation = useMemo(
    () =>
      STEPS.map((key) => {
        let title = '';
        let description = '';
        if (key === BASIC_DETAILS_STEP) {
          title = 'Basic details';
          description = 'Define risk factor name and description and other details.';
        } else if (key === RISK_FACTOR_CONFIGURATION_STEP) {
          title = 'Risk factor configuration';
          description =
            'Configure risk level, risk score and risk weights for the defined risk factors';
        }
        return {
          key,
          title,
          description,
          isOptional: false,
          isInvalid:
            (showValidationError || alwaysShowErrors) &&
            validateField(fieldValidators?.[key], formState?.[key]) != null,
        };
      }),
    [alwaysShowErrors, fieldValidators, formState, showValidationError],
  );

  const internalFormRef = useRef<FormRef<any>>(null);

  useImperativeHandle(forwardedRef, () => ({
    submit: () => internalFormRef.current?.submit(),
    validate: () => internalFormRef.current?.validate(),
    getValues: () => internalFormRef.current?.getValues(),
  }));

  const handleSubmit = (
    formValues: RiskFactorConfigurationFormValues,
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
    <ConfigProvider
      getPopupContainer={(trigger: any) =>
        trigger === undefined ? document.body : trigger.parentElement
      }
    >
      <Form<RiskFactorConfigurationFormValues>
        isDisabled={readonly}
        key={formId}
        id={formId}
        ref={internalFormRef}
        className={s.root}
        initialValues={INITIAL_VALUES}
        initialMeta={changedFields ? makeMetaFromChangedFields(changedFields) : undefined}
        onSubmit={handleSubmit}
        fieldValidators={fieldValidators}
        alwaysShowErrors={alwaysShowErrors || showValidationError}
        onChange={({ values }) => {
          setFormState(values);
        }}
      >
        <ExpandContainer isCollapsed={!showTopCard}>
          {isRiskFactorNameDefined && (
            <NameAndDescription
              ruleName={formState.basicDetailsStep.name}
              ruleDescription={formState.basicDetailsStep.description}
            />
          )}
        </ExpandContainer>
        <div className={s.stepper}>
          <Card.Root className={s.steps}>
            <Card.Section>
              <StepperSteps
                layout="VERTICAL"
                steps={stepsWithValidation}
                active={activeStepKey}
                onChange={onActiveStepChange}
              />
            </Card.Section>
          </Card.Root>
          <div className={cn(s.stepperContent)}>
            <div
              // className={cn(readonly ? s.readOnlyFormContent : '')}
              tabIndex={readonly ? 0 : undefined}
              onKeyDownCapture={
                readonly
                  ? (e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }
                  : undefined
              }
            >
              <NestedForm<RiskFactorConfigurationFormValues> name={activeStepKey}>
                <StepSubformWithRef
                  activeStepKey={activeStepKey}
                  readOnly={readonly}
                  type={type}
                  newRiskId={newRiskId}
                />
              </NestedForm>
            </div>
          </div>
        </div>
      </Form>
    </ConfigProvider>
  );
}

const StepSubform = (
  props: {
    activeStepKey: string;
    readOnly: boolean;
    type: 'consumer' | 'business' | 'transaction';
    newRiskId?: string;
  },
  ref: React.Ref<any>,
) => {
  const { activeStepKey, readOnly, type, newRiskId } = props;
  const ruleType = type === 'transaction' ? 'TRANSACTION' : 'USER';
  const entity =
    type === 'transaction'
      ? 'TRANSACTION'
      : type === 'consumer'
      ? 'CONSUMER_USER'
      : 'BUSINESS_USER';

  if (activeStepKey === BASIC_DETAILS_STEP) {
    return <BasicDetailsStep newRiskId={newRiskId} />;
  }
  if (activeStepKey === RISK_FACTOR_CONFIGURATION_STEP) {
    return (
      <RiskFactorConfigurationStep
        readOnly={readOnly}
        ruleType={ruleType}
        entity={entity}
        ref={ref}
      />
    );
  }
  return <></>;
};

const StepSubformWithRef = React.forwardRef(StepSubform);

export default React.forwardRef(RiskFactorConfigurationForm);

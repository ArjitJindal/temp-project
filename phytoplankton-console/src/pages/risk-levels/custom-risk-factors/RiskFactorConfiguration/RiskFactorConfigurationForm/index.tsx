import { ConfigProvider } from 'antd';
import React, { useMemo, useState } from 'react';
import cn from 'clsx';
import s from './style.module.less';
import { BasicDetailsFormValues, BasicDetailsStep } from './BasicDetailsStep';
import RiskFactorConfigurationStep, {
  RiskFactorConfigurationStepFormValues,
} from './RiskFactorConfigurationStep';
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

interface RiskFactorConfigurationFormProps {
  type: 'consumer' | 'business' | 'transaction';
  showValidationError?: boolean;
  activeStepKey?: string;
  readonly: boolean;
  onActiveStepChange: (key: string) => void;
  onSubmit: (formValues: RiskFactorConfigurationFormValues) => void;
  id?: string;
  formInitialValues?: RiskFactorConfigurationFormValues;
}

export interface RiskFactorConfigurationFormValues {
  basicDetailsStep: BasicDetailsFormValues;
  riskFactorConfigurationStep: Partial<RiskFactorConfigurationStepFormValues>;
}

const BASIC_DETAILS_STEP = 'basicDetailsStep';
const RISK_FACTOR_CONFIGURATION_STEP = 'riskFactorConfigurationStep';

export const STEPS = [BASIC_DETAILS_STEP, RISK_FACTOR_CONFIGURATION_STEP];

function RiskFactorConfigurationForm(
  props: RiskFactorConfigurationFormProps,
  ref: React.Ref<FormRef<any>>,
) {
  const {
    showValidationError = false,
    type,
    activeStepKey = BASIC_DETAILS_STEP,
    readonly,
    onActiveStepChange,
    onSubmit,
    formInitialValues,
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
  const STEPS = useMemo(
    () =>
      [
        {
          key: BASIC_DETAILS_STEP,
          title: 'Basic details',
          isOptional: false,
          description: 'Define risk factor name and description and other details.',
        },
        {
          key: RISK_FACTOR_CONFIGURATION_STEP,
          title: 'Risk factor configuration',
          isOptional: false,
          description:
            'Configure risk level, risk score and risk weights for the defined risk factors',
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
        key={formId}
        id={formId}
        ref={ref}
        className={s.root}
        initialValues={INITIAL_VALUES}
        onSubmit={handleSubmit}
        fieldValidators={fieldValidators}
        alwaysShowErrors={alwaysShowErrors || showValidationError}
        onChange={({ values }) => {
          setFormState(values);
        }}
      >
        <div className={s.stepper}>
          <Card.Root className={s.steps}>
            <Card.Section>
              <StepperSteps
                layout="VERTICAL"
                steps={STEPS}
                active={activeStepKey}
                onChange={onActiveStepChange}
              />
            </Card.Section>
          </Card.Root>
          <div className={cn(s.stepperContent)}>
            <div className={cn(readonly ? s.readOnlyFormContent : '')}>
              <NestedForm<RiskFactorConfigurationFormValues> name={activeStepKey}>
                <StepSubform activeStepKey={activeStepKey} readOnly={readonly} type={type} />
              </NestedForm>
            </div>
          </div>
        </div>
      </Form>
    </ConfigProvider>
  );
}

export default React.forwardRef(RiskFactorConfigurationForm);

function StepSubform(props: {
  activeStepKey: string;
  readOnly: boolean;
  type: 'consumer' | 'business' | 'transaction';
}) {
  const { activeStepKey, readOnly, type } = props;
  const ruleType = type === 'transaction' ? 'TRANSACTION' : 'USER';
  const entity =
    type === 'transaction'
      ? 'TRANSACTION'
      : type === 'consumer'
      ? 'CONSUMER_USER'
      : 'BUSINESS_USER';

  if (activeStepKey === BASIC_DETAILS_STEP) {
    return <BasicDetailsStep />;
  }
  if (activeStepKey === RISK_FACTOR_CONFIGURATION_STEP) {
    return <RiskFactorConfigurationStep readOnly={readOnly} ruleType={ruleType} entity={entity} />;
  }
  return <></>;
}

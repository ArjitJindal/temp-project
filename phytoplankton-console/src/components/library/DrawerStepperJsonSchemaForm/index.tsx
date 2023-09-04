import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { merge } from 'lodash';
import Drawer from '../Drawer';
import StepButtons from '../StepButtons';
import Stepper, { Step } from '../Stepper';

import Form, { FormRef } from '../Form';
import NestedForm from '../Form/NestedForm';

import { message } from '../Message';
import { ExtendedSchema, PropertyItem } from '@/components/library/JsonSchemaEditor/types';
import JsonSchemaEditor from '@/components/library/JsonSchemaEditor';
import { makeValidators } from '@/components/library/JsonSchemaEditor/utils';
import { usePrevious } from '@/utils/hooks';

const FORM_ID = 'drawer-stepper-form';

export type DrawerMode = 'CREATE' | 'UPDATE' | 'READ_ONLY' | 'CLOSED';
export type DrawerStepperJsonSchemaFormStep = { step: Step; jsonSchema: ExtendedSchema };

interface Props<Entity> {
  isVisible: boolean;
  title: string;
  description: string;
  mode: DrawerMode;
  steps: DrawerStepperJsonSchemaFormStep[];
  formInitialValues?: object;
  drawerMaxWidth?: string;
  isSaving?: boolean;
  onChangeVisibility: (visible: boolean) => void;
  onSubmit: (formState: Entity) => void;
}

export function DrawerStepperJsonSchemaForm<Entity>(props: Props<Entity>) {
  const { title, description, isVisible, steps, onSubmit, onChangeVisibility } = props;
  const [activeStepKey, setActiveStepKey] = useState(steps[0].step.key);
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);
  const activeStepIndex = steps.findIndex((step) => step.step.key === activeStepKey);
  const getNestedForm = useCallback(() => {
    return (
      <NestedForm name={activeStepKey}>
        <JsonSchemaEditor
          parametersSchema={steps.find((step) => step.step.key === activeStepKey)!.jsonSchema}
        />
      </NestedForm>
    );
  }, [activeStepKey, steps]);
  const propertyItems: PropertyItem[] = steps.map((step) => ({
    name: step.step.key,
    isRequired: step.step.isOptional === false,
    schema: step.jsonSchema,
  }));
  const fieldValidators = makeValidators(propertyItems, {
    definitions: {
      type: 'object' as const,
      ...merge({}, ...steps.map((step) => step.jsonSchema.definitions)),
    },
  });
  const formRef = useRef<FormRef<any>>(null);
  const formInitialValues = useMemo(() => {
    return (
      props.formInitialValues ??
      (Object.fromEntries(steps.map((step) => [step.step.key, {}])) as any)
    );
  }, [props.formInitialValues, steps]);
  const prevIsVisible = usePrevious(isVisible);
  useEffect(() => {
    if (prevIsVisible !== isVisible) {
      setActiveStepKey(steps[0].step.key);
    }
  }, [isVisible, prevIsVisible, steps]);

  return (
    <Drawer
      isVisible={isVisible}
      onChangeVisibility={onChangeVisibility}
      drawerMaxWidth={props.drawerMaxWidth ?? '500px'}
      title={title}
      description={description}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <StepButtons
            nextDisabled={activeStepIndex === steps.length - 1}
            prevDisabled={activeStepIndex === 0}
            hidePrev={steps.length === 1}
            actionProps={
              props.mode !== 'READ_ONLY'
                ? {
                    actionDisabled: props.isSaving,
                    actionText: props.mode === 'CREATE' ? 'Create' : 'Update',
                    onAction: () => {
                      formRef.current?.submit();
                    },
                  }
                : undefined
            }
            onNext={() => {
              setActiveStepKey(steps[activeStepIndex + 1].step.key);
            }}
            onPrevious={() => {
              setActiveStepKey(steps[activeStepIndex - 1].step.key);
            }}
          />
        </div>
      }
    >
      <Form
        id={FORM_ID}
        ref={formRef}
        fieldValidators={fieldValidators}
        initialValues={formInitialValues}
        alwaysShowErrors={alwaysShowErrors}
        onSubmit={(values, { isValid }) => {
          if (isValid) {
            onSubmit(merge({}, ...Object.values(values)) as Entity);
          } else {
            message.warn(
              'Please make sure that all the required fields are filled and values are valid',
            );
            setAlwaysShowErrors(true);
          }
        }}
      >
        {steps.length > 1 ? (
          <Stepper
            steps={steps.map((step) => step.step)}
            active={activeStepKey}
            onChange={setActiveStepKey}
          >
            {() => getNestedForm()}
          </Stepper>
        ) : (
          getNestedForm()
        )}
      </Form>
    </Drawer>
  );
}

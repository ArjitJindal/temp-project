import React, { useCallback, useImperativeHandle, useRef, useState } from 'react';
import { FieldValidators, Validator } from './utils/validation/types';
import { FieldMeta, FormContext, FormContextValue } from '@/components/library/Form/context';
import { useDeepEqualEffect, useIsChanged } from '@/utils/hooks';
import { validateForm } from '@/components/library/Form/utils/validation/utils';

export interface FormRef<FormValues> {
  getValues: () => FormValues;
  setValues: (formValues: FormValues) => void;
  validate: (externalFormValues?: FormValues) => boolean;
  submit: () => void;
}

interface Props<FormValues> {
  id?: string;
  initialValues: FormValues;
  children: React.ReactNode;
  formValidators?: Validator<FormValues>[];
  fieldValidators?: FieldValidators<FormValues>;
  className?: string;
  alwaysShowErrors?: boolean;
  onSubmit?: (values: FormValues, state: { isValid: boolean }) => void;
  onChange?: (state: { values: FormValues; isValid: boolean }) => void;
}

function Form<FormValues>(props: Props<FormValues>, ref: React.Ref<FormRef<FormValues>>) {
  const {
    id,
    initialValues,
    children,
    fieldValidators,
    formValidators,
    className,
    alwaysShowErrors = false,
    onSubmit,
    onChange,
  } = props;
  const [formValues, setFormValues] = useState<FormValues>(initialValues);
  const [isFormValid, setFormValid] = useState<boolean>(false);
  const [fieldMeta, setFieldsMeta] = useState<{ [key: string]: FieldMeta }>({});
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = useCallback(() => {
    onSubmit?.(formValues, {
      isValid: isFormValid,
    });
  }, [formValues, isFormValid, onSubmit]);

  useImperativeHandle(
    ref,
    (): FormRef<FormValues> => ({
      getValues: (): FormValues => formValues,
      setValues: (formValues: FormValues) => {
        setFormValues(formValues);
      },
      validate: (externalFormValues?: FormValues) => {
        return (
          validateForm(externalFormValues ?? formValues, formValidators, fieldValidators) == null
        );
      },
      submit: () => {
        handleSubmit();
      },
    }),
  );

  const formContext: FormContextValue<FormValues> = {
    alwaysShowErrors: alwaysShowErrors,
    values: formValues,
    setValues: setFormValues,
    meta: fieldMeta,
    setMeta: (key, cb) => {
      setFieldsMeta((state) => ({
        ...state,
        [key]: cb(state[key] ?? {}),
      }));
    },
    fieldValidators,
    formValidators,
  };

  const formValuesChanged = useIsChanged(formValues);
  const formValidChanged = useIsChanged(isFormValid);
  useDeepEqualEffect(() => {
    if (onChange) {
      if (formValuesChanged || formValidChanged) {
        onChange({
          values: formValues,
          isValid: isFormValid,
        });
      }
    }
  }, [onChange, formValuesChanged, formValidChanged]);

  useDeepEqualEffect(() => {
    const validationResult = validateForm(formValues, formValidators, fieldValidators);
    const isFormValidNew = validationResult == null;
    if (isFormValid !== isFormValidNew) {
      setFormValid(isFormValidNew);
    }
  }, [isFormValid, formValues, formValidators, fieldValidators]);

  return (
    <form
      id={id}
      ref={formRef}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <FormContext.Provider value={formContext as FormContextValue<unknown>}>
        {children}
      </FormContext.Provider>
    </form>
  );
}

export default React.forwardRef(Form) as <FormValues>(
  props: Props<FormValues> & { ref?: React.Ref<FormRef<FormValues>> },
) => JSX.Element;

export { InputProps } from '@/components/library/Form/types';

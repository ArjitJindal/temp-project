import React, { useImperativeHandle, useRef, useState } from 'react';
import { FieldValidators, Validator } from './utils/validation/types';
import { FieldMeta, FormContext, FormContextValue } from '@/components/library/Form/context';
import { useDeepEqualEffect, usePrevious } from '@/utils/hooks';
import { isEqual } from '@/utils/lang';
import { checkFormValid, validateForm } from '@/components/library/Form/utils/validation/utils';

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
  const [fieldMeta, setFieldsMeta] = useState<{ [key: string]: FieldMeta }>({});
  const formRef = useRef<HTMLFormElement>(null);

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
        formRef.current?.submit();
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

  const previouValues = usePrevious(formValues);
  useDeepEqualEffect(() => {
    if (onChange) {
      if (!isEqual(formValues, previouValues)) {
        const validationResult = validateForm(formValues, formValidators, fieldValidators);
        onChange({
          values: formValues,
          isValid: validationResult == null,
        });
      }
    }
  }, [onChange, formValues, previouValues]);

  return (
    <form
      id={id}
      ref={formRef}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(formValues, {
          isValid: checkFormValid(formValues, formValidators, fieldValidators),
        });
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

import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import cn from 'clsx';
import { FieldValidators, Validator } from './utils/validation/types';
import s from './index.module.less';
import { FormContext, FormContextValue } from './context';
import { FormValidationResult, validateForm } from './utils/validation/utils';
import { InternalFieldsMeta } from './types';
import { useDeepEqualEffect, useDeepEqualMemo, useIsChanged } from '@/utils/hooks';
import { StatePair } from '@/utils/state';
import Portal from '@/components/library/Portal';

export interface FormRef<FormValues> {
  getValues: () => FormValues;
  setValues: (formValues: FormValues) => void;
  validate: (externalFormValues?: FormValues) => boolean;
  submit: () => void;
  resetFields: (formValues?: FormValues) => void;
}

interface ChildrenProps<FormValues> {
  valuesState: StatePair<FormValues>;
  validationResult: FormValidationResult<FormValues> | null;
}

interface Props<FormValues> {
  id?: string;
  initialValues: FormValues;
  children: React.ReactNode | ((props: ChildrenProps<FormValues>) => React.ReactNode);
  formValidators?:
    | Validator<FormValues>[]
    | ((props: { values: FormValues }) => Validator<FormValues>[]);
  fieldValidators?:
    | FieldValidators<FormValues>
    | ((props: { values: FormValues }) => FieldValidators<FormValues>);
  className?: string;
  alwaysShowErrors?: boolean;
  portaled?: boolean; // useful for creating nested forms
  onSubmit?: (values: FormValues, state: { isValid: boolean }) => void;
  onChange?: (state: { values: FormValues; isValid: boolean }) => void;
}

function Form<FormValues>(props: Props<FormValues>, ref: React.Ref<FormRef<FormValues>>) {
  const {
    portaled,
    id,
    initialValues,
    children,
    className,
    alwaysShowErrors = false,
    onSubmit,
    onChange,
  } = props;

  const [formValues, setFormValues] = useState<FormValues>(initialValues ?? ({} as FormValues));
  const [isFormValid, setFormValid] = useState<boolean>(false);
  const [fieldMeta, setFieldsMeta] = useState<InternalFieldsMeta>({});

  useEffect(() => {
    setFormValues(initialValues ?? ({} as FormValues));
  }, [initialValues]);

  const formRef = useRef<HTMLFormElement>(null);

  const formValidators = useMemo(() => {
    if (typeof props.formValidators === 'function') {
      return (props.formValidators as (props: { values: FormValues }) => Validator<FormValues>[])({
        values: formValues,
      });
    }
    return props.formValidators;
  }, [props.formValidators, formValues]);

  const fieldValidators = useMemo(() => {
    if (typeof props.fieldValidators === 'function') {
      return (
        props.fieldValidators as (props: { values: FormValues }) => FieldValidators<FormValues>
      )({
        values: formValues,
      });
    }
    return props.fieldValidators;
  }, [props.fieldValidators, formValues]);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      onSubmit?.(formValues, {
        isValid: isFormValid,
      });
    },
    [formValues, isFormValid, onSubmit],
  );

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
      resetFields: (values = initialValues) => {
        setFormValues(values);
        setFieldsMeta({});
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

  const validationResult = useDeepEqualMemo(() => {
    return validateForm(formValues, formValidators, fieldValidators);
  }, [isFormValid, formValues, formValidators, fieldValidators]);

  useDeepEqualEffect(() => {
    const validationResult = validateForm(formValues, formValidators, fieldValidators);
    const isFormValidNew = validationResult == null;
    if (isFormValid !== isFormValidNew) {
      setFormValid(isFormValidNew);
    }
  }, [isFormValid, formValues, formValidators, fieldValidators]);

  const result = (
    <FormContext.Provider value={formContext as FormContextValue<unknown>}>
      {typeof children === 'function'
        ? children({ validationResult, valuesState: [formValues, setFormValues] })
        : children}
    </FormContext.Provider>
  );

  if (portaled) {
    return (
      <>
        <Portal>
          <form id={id} ref={formRef} onSubmit={handleSubmit} />
        </Portal>
        {result}
      </>
    );
  }

  return (
    <form id={id} ref={formRef} className={cn(s.form, className)} onSubmit={handleSubmit}>
      {result}
    </form>
  );
}

export default React.forwardRef(Form) as <FormValues>(
  props: Props<FormValues> & { ref?: React.Ref<FormRef<FormValues> | undefined> },
) => JSX.Element;

export { InputProps } from '@/components/library/Form/types';

import React, { useState } from 'react';
import { FieldValidators, Validator } from './utils/validation/types';
import { FieldMeta, FormContext, FormContextValue } from '@/components/library/Form/context';

interface Props<FormValues> {
  initialValues: FormValues;
  children: React.ReactNode;
  formValidators?: Validator<FormValues>[];
  fieldValidators?: FieldValidators<FormValues>;
  onSubmit?: (values: FormValues) => void;
}

export default function Form<FormValues>(props: Props<FormValues>) {
  const { initialValues, children, fieldValidators, formValidators, onSubmit } = props;
  const [formState, setFormState] = useState<FormValues>(initialValues);
  const [fieldMeta, setFieldsMeta] = useState<{ [key: string]: FieldMeta }>({});

  const formContext: FormContextValue<FormValues> = {
    values: formState,
    setValues: setFormState,
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(formState);
      }}
    >
      <FormContext.Provider value={formContext as FormContextValue<unknown>}>
        {children}
      </FormContext.Provider>
    </form>
  );
}

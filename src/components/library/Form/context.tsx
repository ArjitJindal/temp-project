import React from 'react';
import { FieldValidators, FormValidators } from './utils/validation/types';

export interface FieldMeta {
  isTouched?: boolean;
  isVisited?: boolean;
}

export interface FormContextValue<FormValues> {
  values: FormValues;
  setValues: (newValues: FormValues) => void;
  meta: {
    [key: string]: FieldMeta;
  };
  setMeta: (key: string, cb: (prev: FieldMeta) => FieldMeta) => void;
  fieldValidators?: FieldValidators<FormValues>;
  formValidators?: FormValidators<FormValues>;
}

export const FormContext = React.createContext<FormContextValue<unknown> | null>(null);

import React from 'react';
import { FieldValidators, FormValidators } from './utils/validation/types';

export interface FieldMeta {
  isTouched?: boolean;
  isVisited?: boolean;
  children?: MetaMap;
}

interface MetaMap {
  [key: string]: FieldMeta;
}

export interface FormContextValue<FormValues> {
  values: FormValues;
  setValues: (newValues: FormValues) => void;
  meta: MetaMap;
  setMeta: (key: string, cb: (prev: FieldMeta) => FieldMeta) => void;
  alwaysShowErrors: boolean;
  fieldValidators?: FieldValidators<FormValues>;
  formValidators?: FormValidators<FormValues>;
}

export const FormContext = React.createContext<FormContextValue<unknown> | null>(null);

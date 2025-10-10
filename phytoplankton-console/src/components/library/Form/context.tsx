import React, { useContext, Dispatch } from 'react';
import { FieldValidators, FormValidators } from './utils/validation/types';
import { FieldState } from '@/components/library/Form/utils/hooks';
import { Updater } from '@/utils/state';

export interface FieldMeta {
  isTouched?: boolean;
  isVisited?: boolean;
  children?: MetaMap;
}

interface MetaMap {
  [key: string]: FieldMeta;
}

export interface FormContextValue<FormValues> {
  isDisabled: boolean;
  values: FormValues;
  setValues: Dispatch<Updater<FormValues>>;
  meta: MetaMap;
  setMeta: (key: string, cb: (prev: FieldMeta) => FieldMeta) => void;
  alwaysShowErrors: boolean;
  fieldValidators?: FieldValidators<FormValues>;
  formValidators?: FormValidators<FormValues>;
}

export const FormContext = React.createContext<FormContextValue<unknown> | null>(null);

export type FieldContextValue<V> = {
  state: FieldState<V>;
};

export const FieldContext = React.createContext<FieldContextValue<any> | null>(null);

export function useFieldContext<V = unknown>(): FieldState<V> | null {
  const context = useContext(FieldContext);
  return context?.state as FieldState<V>;
}

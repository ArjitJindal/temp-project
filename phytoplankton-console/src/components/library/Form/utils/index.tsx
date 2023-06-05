import React from 'react';
import { FormState } from '../types';
import { useFormState } from './hooks';

export function UseFormState<FormValues>(props: {
  children: (formContext: FormState<FormValues>) => React.ReactNode;
}) {
  const context = useFormState<FormValues>();
  return <>{props.children(context)}</>;
}

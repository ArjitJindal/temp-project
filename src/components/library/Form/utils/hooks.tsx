import { useContext, useMemo } from 'react';
import { FormState } from '../types';
import { FormContext, FormContextValue } from '@/components/library/Form/context';
import { validateForm } from '@/components/library/Form/utils/validation/utils';

export function useFormContext<FormValues>(): FormContextValue<FormValues> {
  const context = useContext(FormContext);
  if (context == null) {
    throw new Error(
      `Form context is not initialized properly. This hook can only be called in component wrapped into Form component`,
    );
  }
  return context as FormContextValue<FormValues>;
}

export function useFormState<FormValues>(): FormState<FormValues> {
  const { values, fieldValidators, formValidators } = useFormContext<FormValues>();

  const validationResult = useMemo(() => {
    return validateForm(values, formValidators, fieldValidators);
  }, [values, fieldValidators, formValidators]);

  return {
    values: values,
    isValid: validationResult == null,
    validationErrors: validationResult?.formValidationErrors ?? [],
  };
}

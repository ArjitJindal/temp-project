import { useContext, useMemo } from 'react';
import { FormState } from '../types';
import { ValidationError, Validator } from '@/components/library/Form/utils/validation/types';
import { FormContext, FormContextValue } from '@/components/library/Form/context';

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

  const formValidationErrors: ValidationError[] = useMemo(() => {
    return (formValidators ?? [])
      .map((validator) => validator(values))
      .filter((x): x is ValidationError => x != null);
  }, [values, formValidators]);

  const isFormValid = useMemo(() => {
    if (formValidationErrors.length > 0) {
      return false;
    }
    const entries = Object.entries(fieldValidators ?? {}) as [
      keyof FormValues,
      Validator<FormValues[keyof FormValues]> | undefined,
    ][];
    const allFieldsValid = entries.every(
      ([name, validator]) => validator == null || validator(values[name]) == null,
    );
    return allFieldsValid;
  }, [values, fieldValidators, formValidationErrors]);

  return {
    values: values,
    isValid: isFormValid,
    validationErrors: formValidationErrors,
  };
}

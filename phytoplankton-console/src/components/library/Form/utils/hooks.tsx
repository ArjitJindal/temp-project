import { SetStateAction, useCallback, useContext, useMemo, Dispatch } from 'react';
import type { FormState } from '../types';
import { FieldMeta, FormContext, FormContextValue } from '@/components/library/Form/context';
import {
  validateField,
  validateForm,
  validationResultToErrorMessage,
} from '@/components/library/Form/utils/validation/utils';
import {
  FieldValidator,
  NestedValidationResult,
  isResultValid,
} from '@/components/library/Form/utils/validation/types';
import { type Updater, applyUpdater } from '@/utils/state';

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
  const { values, fieldValidators, formValidators, setValues } = useFormContext<FormValues>();

  const validationResult = useMemo(() => {
    return validateForm(values, formValidators, fieldValidators);
  }, [values, fieldValidators, formValidators]);

  return {
    values: values,
    isValid: validationResult == null,
    validationErrors: validationResult?.formValidationErrors ?? [],
    setValues: setValues,
  };
}

export interface FieldState<Value> {
  value: Value | undefined;
  onChange: Dispatch<Updater<Value | undefined>>;
  meta: FieldMeta;
  onChangeMeta: (newMeta: SetStateAction<FieldMeta>) => void;
  isValid: boolean;
  showError: boolean;
  validationResult: NestedValidationResult;
  errorMessage: string | null;
}

export function useFieldState<FormValues, Key extends keyof FormValues = keyof FormValues>(
  name: keyof FormValues,
): FieldState<FormValues[Key]> {
  const context = useFormContext<FormValues>();
  const { values, setValues, meta, setMeta, fieldValidators, alwaysShowErrors } = context;

  const value = values[name] as FormValues[Key] | undefined;
  const onChange = useCallback(
    (updater) => {
      setValues((prevValues) => ({
        ...prevValues,
        [name]: applyUpdater(prevValues?.[name], updater),
      }));
    },
    [name, setValues],
  );

  const fieldValidator = (fieldValidators as any)?.[name] as unknown as FieldValidator<
    FormValues[Key] | undefined
  >;

  const validationResult = validateField(fieldValidator, value);

  const fieldMeta: FieldMeta = meta[name as string] ?? {};
  const onChangeMeta: (newMeta: SetStateAction<FieldMeta>) => void = useCallback(
    (newMeta) => {
      const cb = typeof newMeta === 'function' ? newMeta : () => newMeta;
      setMeta(name as string, cb);
    },
    [name, setMeta],
  );

  const isValid = isResultValid(validationResult);
  const showError = !isValid && (fieldMeta?.isVisited || alwaysShowErrors);

  return {
    value,
    onChange,
    isValid,
    showError,
    validationResult: validationResult,
    meta: fieldMeta,
    onChangeMeta: onChangeMeta,
    errorMessage: showError ? validationResultToErrorMessage(validationResult) : null,
  };
}

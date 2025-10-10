import React, { useCallback } from 'react';
import { NestedValidationResult } from '../utils/validation/types';
import { useFieldState, useFormContext } from '@/components/library/Form/utils/hooks';
import { InputProps } from '@/components/library/Form';
import { FieldContext } from '@/components/library/Form/context';

export interface FormFieldRenderProps<Value> extends InputProps<Value> {
  isValid: boolean;
  isTouched: boolean;
  isVisited: boolean;
  showError: boolean;
  onFocus: () => void;
  onBlur: () => void;
  validationResult: NestedValidationResult;
  errorMessage: string | null;
}

interface Props<Key, Value> {
  name: Key;
  children: (props: FormFieldRenderProps<Value>) => JSX.Element;
}

export default function GenericFormField<
  FormValues,
  Key extends keyof FormValues = keyof FormValues,
>(props: Props<Key, FormValues[Key]>): JSX.Element {
  const { name, children } = props;
  const { isDisabled } = useFormContext<FormValues>();
  const fieldState = useFieldState<FormValues, Key>(name);
  const {
    value,
    onChange,
    meta,
    onChangeMeta,
    isValid,
    showError,
    validationResult,
    errorMessage,
  } = fieldState;

  const handleChange = useCallback(
    (value) => {
      onChangeMeta((prev) => ({ ...prev, isVisited: true, isTouched: true }));
      onChange?.(value);
    },
    [onChange, onChangeMeta],
  );

  return (
    <FieldContext.Provider value={{ state: fieldState }}>
      {children({
        value,
        isDisabled: isDisabled,
        onChange: handleChange,
        onFocus: () => {
          onChangeMeta((prev) => ({ ...prev, isTouched: true }));
        },
        onBlur: () => {
          onChangeMeta((prev) => ({ ...prev, isVisited: true }));
        },
        isTouched: meta.isTouched === true,
        isVisited: meta.isVisited === true,
        isValid,
        showError,
        validationResult,
        errorMessage,
      })}
    </FieldContext.Provider>
  );
}

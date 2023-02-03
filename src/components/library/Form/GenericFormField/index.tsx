import React, { useCallback } from 'react';
import { FieldValidator, NestedValidationResult } from '../utils/validation/types';
import { useFormContext } from '@/components/library/Form/utils/hooks';
import { validateField } from '@/components/library/Form/utils/validation/utils';
import { InputProps } from '@/components/library/Form';

interface FormFieldRenderProps<Value> extends InputProps<Value> {
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
  const context = useFormContext<FormValues>();
  const { values, setValues, meta, setMeta, fieldValidators, alwaysShowErrors } = context;
  const value = values[name];
  const onChange = useCallback(
    (newValue) => {
      setValues({
        ...values,
        [name]: newValue,
      });
    },
    [values, name, setValues],
  );
  // todo: fix any
  const fieldValidator = (fieldValidators as any)?.[name] as unknown as FieldValidator<
    FormValues[Key]
  >;
  const validationResult = validateField(fieldValidator, value);

  const isTouched = meta[name as string]?.isTouched === true;
  const isVisited = meta[name as string]?.isVisited === true;
  const isValid = validationResult == null;
  const showError = !isValid && (isVisited || alwaysShowErrors);

  return (
    <>
      {children({
        value,
        onChange,
        onFocus: () => {
          setMeta(name as string, (prev) => ({ ...prev, isTouched: true }));
        },
        onBlur: () => {
          setMeta(name as string, (prev) => ({ ...prev, isVisited: true }));
        },
        isTouched: isTouched,
        isVisited: isVisited,
        isValid: isValid,
        showError: showError,
        validationResult: validationResult,
        errorMessage: showError ? validationResultToErrorMessage(validationResult) : null,
      })}
    </>
  );
}

function validationResultToErrorMessage(validationResult: NestedValidationResult): string | null {
  if (validationResult == null) {
    return null;
  }
  if (typeof validationResult === 'string') {
    return validationResult;
  }
  return Object.entries(validationResult)
    .map(([_, children]) => validationResultToErrorMessage(children))
    .filter((x): x is string => x != null)
    .join('; ');
}

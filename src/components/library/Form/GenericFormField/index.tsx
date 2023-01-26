import React, { useCallback } from 'react';
import { ValidationResult } from '../utils/validation/types';
import { useFormContext } from '@/components/library/Form/utils/hooks';

interface FormFieldRenderProps<Value> {
  value: Value;
  onChange: (newValue: Value) => void;
  isValid: boolean;
  isTouched: boolean;
  isVisited: boolean;
  onFocus: () => void;
  onBlur: () => void;
  validationResult: ValidationResult;
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
  const { values, setValues, meta, setMeta, fieldValidators } = context;
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
  const validationResult = fieldValidators?.[name]?.(value) ?? null;

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
        isTouched: meta[name as string]?.isTouched === true,
        isVisited: meta[name as string]?.isVisited === true,
        isValid: validationResult == null,
        validationResult: validationResult,
      })}
    </>
  );
}

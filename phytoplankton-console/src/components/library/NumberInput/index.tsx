import React, { useCallback, useEffect, useState } from 'react';
import TextInput, { Props as TextInputProps } from '@/components/library/TextInput';
import { InputProps } from '@/components/library/Form';

interface Props extends Omit<TextInputProps, keyof InputProps<string>>, InputProps<number> {
  min?: number;
  max?: number;
  step?: number;
}

export default function NumberInput(props: Props) {
  const { value, onChange, min, max, step = 1, ...rest } = props;
  const valueText = value != null ? `${value}` : undefined;
  const [localValue, setLocalValue] = useState<string | undefined>(valueText);

  useEffect(() => {
    setLocalValue(valueText);
  }, [valueText]);

  const handleConfirmChange = useCallback(
    (newValue: number | undefined) => {
      setLocalValue(`${newValue ?? ''}`);
      onChange?.(newValue);
    },
    [onChange],
  );

  const handleCancelChange = useCallback(() => {
    setLocalValue(`${value ?? ''}`);
  }, [value]);

  const handleBlur = useCallback(() => {
    if (localValue == null || localValue === '') {
      handleConfirmChange(undefined);
      return;
    }
    let number = Number(localValue) ?? null;
    if (number == null) {
      handleCancelChange();
      return;
    }

    number = min != null ? Math.max(min, number) : number;
    number = max != null ? Math.min(max, number) : number;

    handleConfirmChange(number);
  }, [localValue, min, max, handleConfirmChange, handleCancelChange]);

  const handleChange = (newValue: string | undefined) => {
    if (newValue == null) {
      handleConfirmChange(newValue);
    } else {
      setLocalValue(newValue);
    }
  };

  return (
    <TextInput
      {...rest}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      htmlAttrs={{
        type: 'number',
        min: min,
        max: max,
        step,
        ...rest.htmlAttrs,
      }}
    />
  );
}

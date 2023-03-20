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
  const valueText = `${value ?? ''}`;
  const [localValue, setLocalValue] = useState<string | undefined>(valueText);

  useEffect(() => {
    setLocalValue(valueText);
  }, [valueText]);

  const handleChange = useCallback(
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
      handleChange(value);
      return;
    }
    let number = Number(localValue) ?? null;
    if (number == null) {
      handleCancelChange();
      return;
    }

    number = min != null ? Math.max(min, number) : number;
    number = max != null ? Math.min(max, number) : number;

    handleChange(number);
  }, [value, localValue, min, max, handleChange, handleCancelChange]);

  return (
    <TextInput
      {...rest}
      value={localValue}
      onChange={setLocalValue}
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

import React from 'react';
import { InputProps } from '@/components/library/Form/InputField';
import TextInput, { Props as TextInputProps } from '@/components/library/TextInput';

interface Props extends Omit<TextInputProps, keyof InputProps<string>>, InputProps<number> {
  min?: number;
  max?: number;
}

export default function NumberInput(props: Props) {
  const { value, onChange, min, max, ...rest } = props;
  return (
    <TextInput
      {...rest}
      value={value != null ? `${value}` : undefined}
      onChange={(newValue) => {
        const number = Number(newValue) ?? null;
        if (number != null) {
          onChange?.(number);
        }
      }}
      htmlAttrs={{
        type: 'number',
        min: min,
        max: max,
      }}
    />
  );
}

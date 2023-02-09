import React from 'react';
import TextInput, { Props as TextInputProps } from '@/components/library/TextInput';
import { InputProps } from '@/components/library/Form';

interface Props extends Omit<TextInputProps, keyof InputProps<string>>, InputProps<number> {
  min?: number;
  max?: number;
  step?: number;
}

export default function NumberInput(props: Props) {
  const { value, onChange, min, max, step = 1, ...rest } = props;
  return (
    <TextInput
      {...rest}
      value={value != null ? `${value}` : undefined}
      onChange={(newValue) => {
        if (onChange == null) {
          return;
        }
        if (newValue == '' || newValue == undefined) {
          onChange(undefined);
          return;
        }
        let number = Number(newValue) ?? null;
        if (number == null) {
          return;
        }
        number = min != null ? Math.max(min, number) : number;
        number = max != null ? Math.min(max, number) : number;
        onChange(number);
      }}
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

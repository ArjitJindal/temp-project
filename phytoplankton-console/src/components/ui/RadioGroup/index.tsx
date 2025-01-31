import React from 'react';
import Label from '@/components/library/Label';
import Radio, { Props as RadioProps } from '@/components/library/Radio';
import { InputProps } from '@/components/library/Form';
import { Comparable, compare } from '@/utils/comparable';

export type Option<T> = Omit<RadioProps, 'value' | 'onChange'> & {
  value: T;
  label: string;
};

interface Props<T> extends InputProps<T> {
  options: Option<T>[];
}

export default function RadioGroup<T extends Comparable>(props: Props<T>) {
  const { options, value, onChange, ...rest } = props;

  return (
    <>
      {options.map(({ label, ...restOption }) => (
        <div key={String(restOption.value)}>
          <Label label={label} position={'RIGHT'} level={2}>
            <Radio
              {...rest}
              {...restOption}
              value={compare(value, restOption.value)}
              onChange={(value) => {
                if (value) {
                  onChange?.(restOption.value);
                }
              }}
            />
          </Label>
        </div>
      ))}
    </>
  );
}

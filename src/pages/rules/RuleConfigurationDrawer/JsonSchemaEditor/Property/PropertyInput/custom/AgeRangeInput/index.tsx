import React from 'react';
import s from './style.module.less';
import Label from '@/components/library/Label';
import Slider from '@/components/ui/Slider';
import NumberInput from '@/components/library/NumberInput';
import { InputProps } from '@/components/library/Form';

type ValueType = {
  minAge?: {
    granularity?: string;
    units?: number;
  };
  maxAge?: {
    granularity?: string;
    units?: number;
  };
};

interface Props extends InputProps<ValueType> {}

const MIN_AGE = 0;
const MAX_AGE = 100;

export default function AgeRangeInput(props: Props) {
  const { value, onChange, ...rest } = props;
  const minValue = value?.minAge?.units;
  const maxValue = value?.maxAge?.units;
  return (
    <div className={s.root}>
      <Label label={'Min age'} level={2}>
        <NumberInput
          min={0}
          max={maxValue ?? MAX_AGE}
          value={minValue ?? MIN_AGE}
          onChange={(newValue) => {
            onChange?.({
              ...value,
              minAge: {
                units: newValue,
                granularity: 'year',
              },
            });
          }}
          {...rest}
        />
      </Label>
      <Slider
        range={true}
        min={MIN_AGE}
        max={MAX_AGE}
        step={1}
        value={[value?.minAge?.units ?? MIN_AGE, value?.maxAge?.units ?? MAX_AGE]}
        onChange={([min, max]) => {
          onChange?.({
            minAge: {
              units: min,
              granularity: 'year',
            },
            maxAge: {
              units: max,
              granularity: 'year',
            },
          });
        }}
        {...rest}
      />
      <Label label={'Max age'} level={2}>
        <NumberInput
          min={minValue ?? MIN_AGE}
          max={MAX_AGE}
          value={maxValue ?? MAX_AGE}
          onChange={(newValue) => {
            onChange?.({
              ...value,
              maxAge: {
                units: newValue,
                granularity: 'year',
              },
            });
          }}
        />
      </Label>
    </div>
  );
}

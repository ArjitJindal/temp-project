import React from 'react';
import s from './index.module.less';
import Slider from '@/components/library/Slider';
import { InputProps } from '@/components/library/Form';
import NumberInput from '@/components/library/NumberInput';

interface Props extends InputProps<{ start: number; end: number }> {}

export default function SliderWithInputs(props: Props) {
  const { isDisabled, isError, isLoading, onChange, value } = props;
  const marks = {};
  if (value?.start != null) {
    marks[value?.start] = value.start;
  }
  if (value?.end != null) {
    marks[value?.end] = value.end;
  }

  return (
    <div className={s.root}>
      <Slider
        mode="RANGE"
        endExclusive={true}
        marks={marks}
        isError={isError}
        isLoading={isLoading}
        isDisabled={isDisabled || onChange == null}
        value={value ? [value?.start ?? 0, value?.end ?? 0] : undefined}
        onChange={(x: [number, number] | undefined) => {
          if (x == null) {
            return;
          }
          onChange?.({
            start: x[0],
            end: x[1],
          });
        }}
      />
      <div className={s.inputs}>
        <NumberInput
          min={0}
          max={100}
          value={value?.start}
          placeholder="Min. value"
          onChange={(newValue) => {
            const newNumber = newValue ?? 0;
            onChange?.({
              start: newNumber,
              end: Math.max(newNumber, value?.end ?? 0),
            });
          }}
          commitMode="ON_BLUR"
        />
        {'-'}
        <NumberInput
          min={0}
          max={100}
          placeholder="Max. value"
          value={value?.end}
          onChange={(newValue) => {
            const newNumber = newValue ?? 0;
            onChange?.({
              start: Math.min(value?.start ?? 0, newNumber),
              end: newNumber,
            });
          }}
          commitMode="ON_BLUR"
        />
      </div>
    </div>
  );
}

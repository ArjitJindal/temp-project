import { Slider as AntSlider } from 'antd';
import React from 'react';
import cn from 'clsx';
import { SliderBaseProps as AntSliderBaseProps } from 'antd/lib/slider';
import s from './index.module.less';
import { InputProps } from '@/components/library/Form';

export interface CommonProps {
  min?: number;
  max?: number;
  step?: number;
  marks?: AntSliderBaseProps['marks'];
}

interface SingleModeProps extends CommonProps, InputProps<number> {
  mode: 'SINGLE';
  defaultValue?: number;
}

interface RangeModeProps extends CommonProps, InputProps<[number, number]> {
  mode: 'RANGE';
  defaultValue?: [number, number];
  startExclusive?: boolean;
  endExclusive?: boolean;
}

export type Props = SingleModeProps | RangeModeProps;

export default function Slider(props: Props) {
  const commonProps: AntSliderBaseProps = {
    disabled: props.isDisabled,
    step: props.step,
    min: props.min,
    max: props.max,
    marks: props.marks,
  };
  if (props.mode === 'RANGE') {
    return (
      <div className={cn(s.root)} data-cy="age-range-slider">
        <AntSlider
          range={true}
          className={cn(s.slider, {
            [s.disabled]: props.isDisabled,
            [s.startExclusive]: props.startExclusive,
            [s.endExclusive]: props.endExclusive,
          })}
          value={props.value}
          defaultValue={props.defaultValue}
          onChange={props.onChange}
          {...commonProps}
        />
      </div>
    );
  }
  return (
    <div className={cn(s.root)} data-cy="age-range-slider">
      <AntSlider
        range={false}
        className={cn(s.slider, s.single, {
          [s.disabled]: props.isDisabled,
        })}
        disabled={props.isDisabled}
        value={props.value}
        defaultValue={props.defaultValue}
        onChange={props.onChange}
        {...commonProps}
      />
    </div>
  );
}

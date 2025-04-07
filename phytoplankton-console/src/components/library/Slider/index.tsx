import { Slider as AntSlider } from 'antd';
import React from 'react';
import cn from 'clsx';
import { SliderBaseProps as AntSliderBaseProps } from 'antd/lib/slider';
import { isEmpty, omit } from 'lodash';
import NumberInput, { Props as NumberProps } from '../NumberInput';
import s from './index.module.less';
import { InputProps } from '@/components/library/Form';
import { P } from '@/components/ui/Typography';

export interface CommonProps {
  min?: number;
  max?: number;
  step?: number;
  marks?: AntSliderBaseProps['marks'];
  className?: string;
}

interface SingleModeProps extends CommonProps, InputProps<number> {
  mode: 'SINGLE';
  defaultValue?: number;
  textInput?: NumberProps;
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

  return (
    <div className={cn(s.container, props.className)}>
      {props.min && props.marks?.[props.min] ? (
        <P variant="m" fontWeight="normal">
          {props.marks[props.min]}
        </P>
      ) : (
        <></>
      )}
      <div className={cn(s.root)} data-cy="age-range-slider">
        {props.mode === 'RANGE' ? (
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
            {...omit(commonProps, ['marks'])}
          />
        ) : (
          <AntSlider
            range={false}
            className={cn(s.slider, s.single, {
              [s.disabled]: props.isDisabled,
            })}
            disabled={props.isDisabled}
            value={props.value}
            defaultValue={props.defaultValue}
            onChange={props.onChange}
            {...omit(commonProps, ['marks'])}
          />
        )}
      </div>
      {props.max && props.marks?.[props.max] && (
        <P variant="m" fontWeight="normal" style={{ marginLeft: '0.25rem' }}>
          {props.marks[props.max]}
        </P>
      )}
      {props.mode === 'SINGLE' && props.textInput && !isEmpty(props.textInput) && (
        <div style={{ marginLeft: '0.5rem' }}>
          <NumberInput {...omit(props, ['className'])} htmlAttrs={props.textInput.htmlAttrs} />
        </div>
      )}
    </div>
  );
}

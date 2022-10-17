import { Slider as AntSlider } from 'antd';
import React from 'react';
import cn from 'clsx';
import {
  SliderRangeProps as AntSliderSingleProps,
  SliderSingleProps as AntSliderRangeProps,
} from 'antd/lib/slider';
import s from './index.module.less';

interface ExtraProps {
  startExclusive?: boolean;
  endExclusive?: boolean;
}

type AntProps = AntSliderSingleProps | AntSliderRangeProps;

export default function Slider(props: AntProps & ExtraProps) {
  const { startExclusive, endExclusive, ...rest } = props;
  return (
    <AntSlider
      className={cn(s.root, {
        [s.disabled]: rest.disabled,
        [s.startExclusive]: startExclusive,
        [s.endExclusive]: endExclusive,
      })}
      {...rest}
    />
  );
}

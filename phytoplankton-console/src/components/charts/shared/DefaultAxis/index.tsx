import React from 'react';

import { AxisBottom as VisxAxisBottom, AxisLeft as VisxAvisLeft } from '@visx/axis';
import { AxisScale, SharedAxisProps } from '@visx/axis/lib/types';
import { TextProps } from '@visx/text/lib/Text';
import { ScaleInput } from '@visx/scale';
import cn from 'clsx';
import s from './index.module.less';
import { DEFAULT_AXIS_FONT_STYLE } from '@/components/charts/shared/text';
import { COLORS_V2_GRAY_6, COLORS_V2_SKELETON_COLOR } from '@/components/ui/colors';
import { SKELETON_TICK_COMPONENT } from '@/components/charts/BarChart/helpers';
import { DEFAULT_X_AXIS_LABEL_ANGLE } from '@/components/charts/shared/helpers';
import { DEFAULT_NUMBER_FORMATTER } from '@/components/charts/shared/formatting';

type Props<Scale extends AxisScale> = SharedAxisProps<Scale> & {
  showSkeleton?: boolean;
  tickLabelProps?: (
    value: ScaleInput<Scale>,
    index: number,
    values: {
      value: ScaleInput<Scale>;
      index: number;
    }[],
  ) => Partial<TextProps>;
};

export function DefaultAxisBottom<Scale extends AxisScale>(props: Props<Scale>) {
  const { showSkeleton = false, tickLabelProps, ...rest } = props;
  const axisColor = showSkeleton ? COLORS_V2_SKELETON_COLOR : COLORS_V2_GRAY_6;
  return (
    <VisxAxisBottom
      stroke={axisColor}
      tickStroke={axisColor}
      hideTicks={showSkeleton}
      tickComponent={showSkeleton ? SKELETON_TICK_COMPONENT : undefined}
      {...rest}
      tickLabelProps={(...args) => {
        const tickLabelPropsResult = tickLabelProps ? tickLabelProps(...args) : {};
        return {
          fontSize: DEFAULT_AXIS_FONT_STYLE.fontSize,
          fontWeight: DEFAULT_AXIS_FONT_STYLE.fontWeight,
          fontFamily: DEFAULT_AXIS_FONT_STYLE.fontFamily,
          textAnchor: 'end',
          angle: 180 * (DEFAULT_X_AXIS_LABEL_ANGLE / Math.PI),
          fill: axisColor,
          ...tickLabelPropsResult,
          className: cn(s.tick, tickLabelPropsResult.className),
        };
      }}
    />
  );
}

export function DefaultAxisLeft<Scale extends AxisScale>(props: Props<Scale>) {
  const { showSkeleton = false, tickLabelProps, ...rest } = props;
  const axisColor = showSkeleton ? COLORS_V2_SKELETON_COLOR : COLORS_V2_GRAY_6;
  return (
    <VisxAvisLeft
      stroke={axisColor}
      tickStroke={axisColor}
      tickComponent={showSkeleton ? SKELETON_TICK_COMPONENT : undefined}
      tickFormat={DEFAULT_NUMBER_FORMATTER}
      {...rest}
      tickLabelProps={(...args) => {
        const tickLabelPropsResult = tickLabelProps ? tickLabelProps(...args) : {};
        return {
          fontSize: DEFAULT_AXIS_FONT_STYLE.fontSize,
          fontWeight: DEFAULT_AXIS_FONT_STYLE.fontWeight,
          fontFamily: DEFAULT_AXIS_FONT_STYLE.fontFamily,
          textAnchor: 'end',
          fill: axisColor,
          ...tickLabelPropsResult,
          className: cn(s.tick, tickLabelPropsResult.className),
        };
      }}
    />
  );
}

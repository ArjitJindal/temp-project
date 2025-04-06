import React, { useMemo } from 'react';
import { ScaleLinear } from 'd3-scale';

import { AxisBottom as VisxAxisBottom, AxisLeft as VisxAvisLeft } from '@visx/axis';
import { AxisScale, SharedAxisProps } from '@visx/axis/lib/types';
import { TextProps } from '@visx/text/lib/Text';
import { ScaleInput } from '@visx/scale';
import { Text } from '@visx/text';
import cn from 'clsx';
import s from './index.module.less';
import { DEFAULT_AXIS_FONT_STYLE } from '@/components/charts/shared/text';
import { COLORS_V2_GRAY_6, COLORS_V2_SKELETON_COLOR } from '@/components/ui/colors';
import { SKELETON_TICK_COMPONENT } from '@/components/charts/BarChart/helpers';
import { generateEvenTicks } from '@/components/charts/shared/helpers';
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

const WrappedTickComponent = ({ x, y, formattedValue, ...props }: any) => {
  return (
    <Text
      x={x}
      y={y}
      width={40}
      maxWidth={40}
      verticalAnchor="start"
      textAnchor="middle"
      {...props}
      style={{
        fontSize: DEFAULT_AXIS_FONT_STYLE.fontSize,
        fontWeight: DEFAULT_AXIS_FONT_STYLE.fontWeight,
        fontFamily: DEFAULT_AXIS_FONT_STYLE.fontFamily,
      }}
      className={s.tick}
    >
      {formattedValue}
    </Text>
  );
};

export function DefaultAxisBottom<Scale extends AxisScale>(props: Props<Scale>) {
  const { showSkeleton = false, tickLabelProps, ...rest } = props;
  const axisColor = showSkeleton ? COLORS_V2_SKELETON_COLOR : COLORS_V2_GRAY_6;

  return (
    <VisxAxisBottom
      stroke={axisColor}
      tickStroke={axisColor}
      hideTicks={showSkeleton}
      tickComponent={showSkeleton ? SKELETON_TICK_COMPONENT : WrappedTickComponent}
      {...rest}
      tickLabelProps={(...args) => {
        const tickLabelPropsResult = tickLabelProps ? tickLabelProps(...args) : {};
        return {
          fill: axisColor,
          ...tickLabelPropsResult,
          className: cn(s.tick, tickLabelPropsResult.className),
        };
      }}
    />
  );
}

const Y_TICKS_GAP = 5;
const Y_MIN_TICKS = 2;
const Y_MAX_TICKS = 10;

export function DefaultAxisLeft<Scale extends AxisScale>(props: Props<Scale>) {
  const { showSkeleton = false, tickLabelProps, scale, ...rest } = props;
  const axisColor = showSkeleton ? COLORS_V2_SKELETON_COLOR : COLORS_V2_GRAY_6;

  const ticksCount = useMemo(() => {
    const range = scale.range();
    const y1 = range[0]?.valueOf() ?? 0;
    const y2 = range[1]?.valueOf() ?? 0;
    const height = Math.max(y1 ?? 0, y2) - Math.min(y1, y2);
    return Math.max(
      Y_MIN_TICKS,
      Math.min(Math.floor(height / (DEFAULT_AXIS_FONT_STYLE.fontSize + Y_TICKS_GAP)), Y_MAX_TICKS),
    );
  }, [scale]);

  const ticks = useMemo(
    () => generateEvenTicks(scale as ScaleLinear<number, number>, ticksCount),
    [scale, ticksCount],
  );

  return (
    <VisxAvisLeft
      stroke={axisColor}
      numTicks={ticksCount}
      tickStroke={axisColor}
      tickComponent={showSkeleton ? SKELETON_TICK_COMPONENT : undefined}
      tickFormat={DEFAULT_NUMBER_FORMATTER}
      scale={scale}
      tickValues={ticks}
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

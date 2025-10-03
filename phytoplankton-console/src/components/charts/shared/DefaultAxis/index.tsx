import React, { useMemo } from 'react';
import { ScaleLinear } from 'd3-scale';

import { AxisBottom as VisxAxisBottom, AxisLeft as VisxAvisLeft } from '@visx/axis';
import { AxisScale, SharedAxisProps } from '@visx/axis/lib/types';
import { TextProps } from '@visx/text/lib/Text';
import { ScaleInput } from '@visx/scale';
import cn from 'clsx';
import s from './index.module.less';
import { DEFAULT_AXIS_FONT_STYLE, measureTextSize } from '@/components/charts/shared/text';
import { COLORS_V2_GRAY_6, COLORS_V2_SKELETON_COLOR } from '@/components/ui/colors';
import { SKELETON_TICK_COMPONENT } from '@/components/charts/BarChart/helpers';
import { generateEvenTicks } from '@/components/charts/shared/helpers';
import { DEFAULT_NUMBER_FORMATTER } from '@/components/charts/shared/formatting';
import { BarGrouping } from '@/components/charts/BarChart';
type Props<Scale extends AxisScale> = SharedAxisProps<Scale> & {
  showSkeleton?: boolean;
  centerBandTicks?: boolean;
  tickLabelProps?: (
    value: ScaleInput<Scale>,
    index: number,
    values: {
      value: ScaleInput<Scale>;
      index: number;
    }[],
  ) => Partial<TextProps>;
  grouping?: BarGrouping;
};

const MAX_TICK_LINES = 3;

function wrapTickLabel(text: string, width: number): string {
  if (!text || !width) {
    return text;
  }
  const words = text.split(/(\s+|[-/])/); // keep separators to preserve meaning
  const lines: string[] = [''];

  const measure = (s: string) => measureTextSize(s, DEFAULT_AXIS_FONT_STYLE).width;

  const splitWordWithHyphen = (word: string): string[] => {
    const parts: string[] = [];
    let buf = '';
    for (const ch of word) {
      const candidate = buf + ch + '-';
      if (measure(candidate) <= width) {
        buf = buf + ch;
      } else {
        if (buf.length === 0) {
          parts.push(ch + '-');
        } else {
          parts.push(buf + '-');
          buf = ch;
        }
      }
    }
    if (buf.length > 0) {
      parts.push(buf);
    }
    return parts;
  };

  for (const token of words) {
    const isSpace = /^\s+$/.test(token);
    const isWord = !isSpace && !/^[-/]$/.test(token);
    const toAppend = token;

    if (isWord && measure(token) > width) {
      const hyphenParts = splitWordWithHyphen(token);
      for (let pIndex = 0; pIndex < hyphenParts.length; pIndex++) {
        const part = hyphenParts[pIndex];
        const currentLine = lines[lines.length - 1];
        const next = currentLine + part;
        if (measure(next) <= width) {
          lines[lines.length - 1] = next;
        } else if (lines.length < MAX_TICK_LINES) {
          lines.push(part);
        } else {
          const last = lines[lines.length - 1];
          let acc = last;
          for (const ch of part) {
            if (measure(acc + ch + '…') <= width) {
              acc = acc + ch;
            } else {
              break;
            }
          }
          lines[lines.length - 1] = acc + '…';
          return lines.join('\n');
        }
      }
      continue;
    }

    const currentLine = lines[lines.length - 1];
    const next = currentLine + toAppend;
    if (measure(next) <= width || currentLine.length === 0) {
      lines[lines.length - 1] = next;
    } else if (lines.length < MAX_TICK_LINES) {
      lines.push(toAppend.trimStart());
    } else {
      let acc = currentLine;
      for (const ch of toAppend) {
        if (measure(acc + ch + '…') <= width) {
          acc = acc + ch;
        } else {
          break;
        }
      }
      lines[lines.length - 1] = acc + '…';
      return lines.join('\n');
    }
  }

  return lines.join('\n');
}

const HtmlTick = ({ x, y, formattedValue, width, fill }: any) => {
  const w = width ?? 70;
  const text = wrapTickLabel(String(formattedValue ?? ''), w);
  const linePx = Math.round((DEFAULT_AXIS_FONT_STYLE.fontSize as number) * 1.3);
  const height = linePx * MAX_TICK_LINES;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <foreignObject x={-w / 2} y={4} width={w} height={height}>
        <div
          style={{
            color: fill,
            fontFamily: DEFAULT_AXIS_FONT_STYLE.fontFamily,
            fontWeight: DEFAULT_AXIS_FONT_STYLE.fontWeight as any,
            fontSize: DEFAULT_AXIS_FONT_STYLE.fontSize as any,
            lineHeight: `${linePx}px`,
            textAlign: 'center',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            hyphens: 'auto',
          }}
        >
          {text}
        </div>
      </foreignObject>
    </g>
  );
};

export function DefaultAxisBottom<Scale extends AxisScale>(props: Props<Scale>) {
  const { showSkeleton = false, tickLabelProps, scale, ...rest } = props;
  const axisColor = showSkeleton ? COLORS_V2_SKELETON_COLOR : COLORS_V2_GRAY_6;

  const step = (scale as any).step ? (scale as any).step() : 0;
  const MIN_GAP = 6;
  const MAX_TICK_WIDTH = 90;
  const tickWidth = Math.max(
    48,
    Math.min(MAX_TICK_WIDTH, step ? Math.max(32, step - MIN_GAP) : MAX_TICK_WIDTH),
  );

  return (
    <VisxAxisBottom
      stroke={axisColor}
      tickStroke={axisColor}
      hideTicks={showSkeleton}
      tickComponent={showSkeleton ? SKELETON_TICK_COMPONENT : HtmlTick}
      scale={scale}
      {...rest}
      tickLabelProps={(...args): Partial<TextProps> => {
        const tickLabelPropsResult = tickLabelProps ? tickLabelProps(...args) : {};

        return {
          ...tickLabelPropsResult,
          fill: axisColor,
          dy: '0.5em',
          textAnchor: 'middle',
          width: tickWidth,
          lineHeight: 1.1,
          className: cn(s.tick, tickLabelPropsResult?.className),
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
          dx: '0.5em',
          fill: axisColor,
          ...tickLabelPropsResult,
          className: cn(s.tick, tickLabelPropsResult.className),
        };
      }}
    />
  );
}

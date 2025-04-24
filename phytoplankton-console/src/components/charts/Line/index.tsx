import { LinePath } from '@visx/shape';
import { StringLike } from '@visx/scale';
import { groupBy } from 'lodash';
import React from 'react';
import { Group } from '@visx/group';
import { useTooltip, useTooltipInPortal } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import cn from 'clsx';
import { LineData } from './types';
import s from './index.module.less';
import DefaultChartContainer from '@/components/charts/shared/DefaultChartContainer';
import { TooltipData, useColorScale, useScales } from '@/components/charts/Line/helpers';

import { DEFAULT_PADDINGS, Paddings } from '@/components/charts/shared/helpers';
import { COLORS_V2_SKELETON_COLOR } from '@/components/ui/colors';
import { AsyncResource, getOr, isLoading, map } from '@/utils/asyncResource';
import { makeRandomNumberGenerator } from '@/utils/prng';
import SeriesTooltip from '@/components/charts/shared/SeriesTooltip';
import CustomLegendOrdinal from '@/components/charts/shared/CustomLegendOrdinal';
import { DEFAULT_FORMATTER, Formatter } from '@/components/charts/shared/formatting';
import { DefaultAxisBottom, DefaultAxisLeft } from '@/components/charts/shared/DefaultAxis';

const random = makeRandomNumberGenerator(999999);
const SKELETON_DATA: LineData<string, string> = [...new Array(20)].map((_, i) => ({
  xValue: `${i}`,
  yValue: 10 + random() * 100,
  series: random() < 0.5 ? 'First line' : 'Another line with long title',
}));

export * from './types';

interface Props<X extends StringLike, Series extends StringLike> {
  data: AsyncResource<LineData<X, Series>>;
  colors: { [key: string]: string | undefined };
  height?: number;
  hideLegend?: boolean;
  formatX?: Formatter<X>;
  formatY?: Formatter<number>;
  formatSeries?: Formatter<Series>;
  // dashedLinesSeries?: Series[];
  // customTooltip?: Tooltip;
}

export default function LineChart<X extends StringLike, Series extends StringLike>(
  props: Props<X, Series>,
) {
  const {
    data,
    height,
    colors,
    hideLegend,
    // dashedLinesSeries,
    // customTooltip,
    formatX = DEFAULT_FORMATTER,
    formatY = DEFAULT_FORMATTER,
    formatSeries = DEFAULT_FORMATTER,
  } = props;
  // const tooltip = customTooltip ? { tooltip: customTooltip } : {};

  const showSkeleton = isLoading(data) && getOr(data, null) == null;
  const dataValue: LineData<string, string> = getOr(
    map(data, (value) => {
      return value.map((item) => ({
        xValue: formatX(item.xValue),
        yValue: item.yValue,
        series: item.series ? formatSeries(item.series) : '',
      }));
    }),
    showSkeleton ? SKELETON_DATA : [],
  );

  const colorScale = useColorScale(dataValue, colors);

  return (
    <DefaultChartContainer
      showSkeleton={showSkeleton}
      height={height}
      hideLegend={hideLegend}
      renderChart={({ size }) => (
        <Chart
          size={size}
          data={dataValue}
          colors={colors}
          showSkeleton={showSkeleton}
          formatY={formatY}
        />
      )}
      renderLegend={() => (
        <CustomLegendOrdinal {...props} scale={colorScale} showSkeleton={showSkeleton} />
      )}
    />
  );
}

function Chart<X extends StringLike, Series extends StringLike>(props: {
  data: LineData<X, Series>;
  size: { width: number; height: number };
  colors: { [key: string]: string | undefined };
  paddings?: Paddings;
  showSkeleton?: boolean;
  formatY: (value: number) => string;
}) {
  const { data, size, colors, showSkeleton = false, formatY } = props;
  const colorScale = useColorScale(data, colors);
  const { scales, paddings } = useScales<X, Series>(data, size, DEFAULT_PADDINGS);
  const { xScale, yScale } = scales;
  const lines = groupBy(data, ({ series }) => series?.toString() ?? '');
  const innerHeight = size.height - paddings.bottom - paddings.top;

  const { tooltipOpen, tooltipLeft, tooltipTop, tooltipData, hideTooltip, showTooltip } =
    useTooltip<TooltipData<X>>();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    scroll: true,
  });

  const highlightedItems =
    tooltipOpen && tooltipData != null
      ? data
          .map((x) => x.xValue.toString())
          .filter((xValue) => xValue.toString() === tooltipData.xValue.toString())
      : [];

  const findNearestXValue = (mouseX: number) => {
    const xPositions = data.map((item) => xScale(item.xValue));
    const mousePosition = mouseX - paddings.left;

    let nearestIndex = 0;
    const firstPosition = xPositions[0];
    if (!firstPosition) {
      return data[0].xValue;
    }

    let minDistance = Math.abs(firstPosition - mousePosition);

    for (let i = 1; i < xPositions.length; i++) {
      const position = xPositions[i];
      if (!position) {
        continue;
      }

      const distance = Math.abs(position - mousePosition);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }

    return data[nearestIndex].xValue;
  };

  return (
    <>
      <svg
        className={cn(showSkeleton && s.showSkeleton)}
        width={size.width}
        height={size.height}
        ref={containerRef}
      >
        <Group top={paddings.top} left={paddings.left}>
          <rect
            className={cn(s.highlightLine, highlightedItems.length > 0 && s.isHighlighted)}
            width={2}
            x={tooltipData ? (xScale(tooltipData.xValue) ?? 0) - 1 : 0}
            height={innerHeight}
          />
          {Object.entries(lines).map(([key, lineData]) => {
            const stroke = showSkeleton
              ? COLORS_V2_SKELETON_COLOR
              : colorScale(key as unknown as Series);
            return (
              <React.Fragment key={key}>
                <LinePath
                  data={lineData}
                  x={(item) => {
                    return xScale(item.xValue) ?? 0;
                  }}
                  y={(item) => {
                    return yScale(item.yValue) ?? 0;
                  }}
                  stroke={stroke}
                />
                {lineData.map((item, j) => {
                  const x = xScale(item.xValue) ?? 0;
                  const y = yScale(item.yValue) ?? 0;
                  const isHighlighted = highlightedItems.includes(item.xValue.toString());
                  return (
                    <React.Fragment key={`${key}-${j}`}>
                      <circle
                        className={s.marker}
                        r={isHighlighted ? 3 : 1}
                        cx={x}
                        cy={y}
                        stroke={stroke}
                        fill={stroke}
                      />
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
          <rect
            className={cn(s.mouseTargetLine)}
            width={size.width - paddings.left - paddings.right}
            height={innerHeight}
            x={0}
            fill="transparent"
            onMouseLeave={() => {
              hideTooltip();
            }}
            onMouseMove={(event) => {
              const eventSvgCoords = localPoint(event);
              if (eventSvgCoords) {
                const nearestX = findNearestXValue(eventSvgCoords.x);
                showTooltip({
                  tooltipData: {
                    xValue: nearestX,
                  },
                  tooltipTop: eventSvgCoords.y,
                  tooltipLeft: eventSvgCoords.x,
                });
              }
            }}
          />
          <DefaultAxisLeft left={0} scale={yScale} />
          <DefaultAxisBottom left={0} top={innerHeight} scale={xScale} />
        </Group>
      </svg>
      {tooltipOpen && tooltipData && (
        <TooltipInPortal top={tooltipTop} left={tooltipLeft}>
          <SeriesTooltip
            title={tooltipData.xValue.toString()}
            items={data
              .filter((x) => highlightedItems.includes(x.xValue.toString()))
              .map((x) => ({
                color: x.series ? colorScale(x.series) : undefined,
                label: x.series?.toString() ?? '',
                value: formatY(x.yValue),
              }))}
          />
        </TooltipInPortal>
      )}
    </>
  );
}

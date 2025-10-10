import { StringLike } from '@visx/scale';
import Pie from '@visx/shape/lib/shapes/Pie';
import React, { useState } from 'react';
import { Group } from '@visx/group';
import cn from 'clsx';
import { localPoint } from '@visx/event';
import { DONUT_THICKNESS, Highlighted, useColorScale } from './helpers';
import s from './index.module.less';
import { DonutData, DonutDataItem } from './types';
import { AsyncResource, getOr, isLoading, map } from '@/utils/asyncResource';
import { makeRandomNumberGenerator } from '@/utils/prng';
import CustomLegendOrdinal from '@/components/charts/shared/CustomLegendOrdinal';
import SeriesTooltip from '@/components/charts/shared/SeriesTooltip';
import DefaultChartContainer from '@/components/charts/shared/DefaultChartContainer';
import { DEFAULT_FONT_STYLE } from '@/components/charts/shared/text';
import FitText from '@/components/charts/shared/FitText';
import { COLORS_V2_SKELETON_COLOR } from '@/components/ui/colors';
import {
  DEFAULT_FORMATTER,
  DEFAULT_NUMBER_FORMATTER,
  Formatter,
} from '@/components/charts/shared/formatting';
import { StatePair } from '@/utils/state';
import { TooltipWrapper, useTooltipState } from '@/components/charts/shared/TooltipWrapper';

const random = makeRandomNumberGenerator(999999);
const SKELETON_DATA: DonutData<string> = [...new Array(8)].map((_) => ({
  name: `name_` + [...new Array(Math.round(random() * 20))].map(() => 'x').join(''),
  value: 10 + random() * 100,
}));

export * from './types';

interface Props<Name extends StringLike> {
  data: AsyncResource<DonutData<Name>>;
  colors: { [key: string]: string | undefined };
  height?: number;
  hideLegend?: boolean;
  formatName?: Formatter<Name>;
  formatValue?: Formatter<number>;
}

export default function DonutChart<Name extends StringLike>(props: Props<Name>) {
  const {
    data,
    height,
    colors,
    hideLegend,
    formatName = DEFAULT_FORMATTER,
    formatValue = DEFAULT_NUMBER_FORMATTER,
  } = props;

  const [disabledSeries, setDisabledSeries] = useState<string[]>([]);

  const showSkeleton = isLoading(data) && getOr(data, null) == null;
  const dataValue: DonutData<string> = getOr(
    map(data, (value) => {
      return value
        .filter((item) => item.value !== 0)
        .map((item) => {
          const name = item.name ? formatName(item.name) : '';
          return {
            name,
            value: disabledSeries.includes(name) ? 0 : item.value,
          };
        });
    }),
    showSkeleton ? SKELETON_DATA : [],
  );

  const colorScale = useColorScale(dataValue, colors);

  const [highlighted, setHighlighted] = useState<Highlighted<string>>({
    name: null,
  });

  return (
    <DefaultChartContainer
      showSkeleton={showSkeleton}
      height={height}
      hideLegend={hideLegend}
      orientation={'HORIZONTAL'}
      renderChart={(props) => (
        <Chart
          {...props}
          data={dataValue}
          colors={colors}
          formatValue={formatValue}
          highlightedState={[highlighted, setHighlighted]}
        />
      )}
      renderLegend={(renderProps) => (
        <CustomLegendOrdinal
          {...renderProps}
          scale={colorScale}
          disabledSeries={disabledSeries}
          onItemClick={(series, toDisable) => {
            setDisabledSeries((prevState) =>
              toDisable ? [...prevState, series] : prevState.filter((x) => x !== series),
            );
          }}
          onItemMouseMove={(series: string) => {
            setHighlighted((prevState) => ({
              ...prevState,
              name: series,
            }));
          }}
          onItemMouseLeave={() => {
            setHighlighted((prevState) => ({
              ...prevState,
              name: null,
            }));
          }}
        />
      )}
    />
  );
}

function Chart<Name extends StringLike>(props: {
  data: DonutData<Name>;
  size: { width: number; height: number };
  colors: { [key: string]: string | undefined };
  showSkeleton?: boolean;
  formatValue: (value: number) => string;
  highlightedState: StatePair<Highlighted<Name>>;
}) {
  const { data, size, colors, showSkeleton = false, formatValue, highlightedState } = props;
  const colorScale = useColorScale(data, colors);

  const [highlighted, setHighlighted] = highlightedState;

  const radius = Math.min(size.width, size.height) / 2;

  const isNoData = !data.some((x) => x.value !== 0);

  const { showTooltip, hideTooltip, state } = useTooltipState<DonutDataItem<Name>>();

  return (
    <TooltipWrapper
      tooltipState={state}
      tooltipComponent={({ tooltipData }) => (
        <SeriesTooltip
          items={[
            {
              color: colorScale(tooltipData.name),
              label: tooltipData.name.toString(),
              value: formatValue(tooltipData.value),
            },
          ]}
        />
      )}
    >
      {({ containerRef }) => (
        <>
          <svg
            className={cn(s.svg, (showSkeleton || isNoData) && s.disabled)}
            width={size.width}
            height={size.height}
            ref={containerRef}
          >
            <Group top={size.height / 2} left={size.width / 2}>
              <Pie<DonutDataItem<Name>>
                data={isNoData ? [{ name: 'No data' as unknown as Name, value: 1 }] : data}
                pieValue={(item) => {
                  return item.value;
                }}
                outerRadius={radius}
                innerRadius={radius - DONUT_THICKNESS}
              >
                {({ arcs, path }) =>
                  arcs.map((arc) => {
                    const item = arc.data;
                    const color = colorScale(item.name);
                    const [centroidX, centroidY] = path.centroid(arc);
                    const hasSpaceForLabel = arc.endAngle - arc.startAngle >= 0.1;
                    return (
                      <React.Fragment key={item.name.toString()}>
                        <path
                          className={cn(s.arc, {
                            [s.highlighting]: highlighted.name != null,
                            [s.isHighlighted]:
                              highlighted.name?.toString() === item.name.toString(),
                          })}
                          d={path(arc) ?? ''}
                          stroke={showSkeleton ? 'white' : color}
                          fill={showSkeleton || isNoData ? COLORS_V2_SKELETON_COLOR : color}
                          strokeWidth={showSkeleton ? 2 : 0}
                          onMouseLeave={() => {
                            hideTooltip();
                            setHighlighted((prevState) => ({
                              ...prevState,
                              name: null,
                            }));
                          }}
                          onMouseMove={(event) => {
                            const eventSvgCoords = localPoint(event);
                            showTooltip({
                              tooltipData: item,
                              tooltipTop: eventSvgCoords?.y,
                              tooltipLeft: eventSvgCoords?.x,
                            });
                            setHighlighted((prevState) => ({
                              ...prevState,
                              name: item.name,
                            }));
                          }}
                        />
                        {!showSkeleton && hasSpaceForLabel && (
                          <FitText
                            fontStyle={DEFAULT_FONT_STYLE}
                            rect={{ width: 100, height: 100 }}
                            x={centroidX}
                            y={centroidY}
                            dominantBaseline="middle"
                            textAnchor="middle"
                            pointerEvents="none"
                          >
                            {isNoData ? 'No data' : formatValue(item.value)}
                          </FitText>
                        )}
                      </React.Fragment>
                    );
                  })
                }
              </Pie>
            </Group>
          </svg>
        </>
      )}
    </TooltipWrapper>
  );
}

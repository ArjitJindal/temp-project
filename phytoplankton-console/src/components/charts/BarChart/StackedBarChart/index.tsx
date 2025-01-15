import React, { useMemo, useState } from 'react';
import { BarStack } from '@visx/shape';
import { Group } from '@visx/group';
import { StringLike } from '@visx/scale';
import { localPoint } from '@visx/event';
import { groupBy, mapKeys, uniq } from 'lodash';
import cn from 'clsx';
import { DefaultAxisBottom, DefaultAxisLeft } from 'src/components/charts/shared/DefaultAxis';
import { ColorsMap } from '../types';
import { BarChartData, Props as BarChartProps } from '../index';
import { Highlighted, useColorScale, usePreparedCustomColoring } from '../helpers';
import s from './index.module.less';
import { SKELETON_PADDINGS, useScales } from './helpers';
import CustomLegendOrdinal from '@/components/charts/shared/CustomLegendOrdinal';
import SeriesTooltip from '@/components/charts/shared/SeriesTooltip';
import { makeRandomNumberGenerator } from '@/utils/prng';
import { getOr, isLoading, map } from '@/utils/asyncResource';
import { COLORS_V2_SKELETON_COLOR } from '@/components/ui/colors';
import { StatePair } from '@/utils/state';
import DefaultChartContainer from '@/components/charts/shared/DefaultChartContainer';
import { BAR_CHART_DEFAULT_PADDINGS, Paddings, Rect } from '@/components/charts/shared/helpers';
import { DEFAULT_FORMATTER } from '@/components/charts/shared/formatting';
import { TooltipWrapper, useTooltipState } from '@/components/charts/shared/TooltipWrapper';
import DefaultChartTooltip from '@/components/charts/shared/DefaultChartTooltip';

const random = makeRandomNumberGenerator(999999);
const SKELETON_DATA: BarChartData<string, string> = [...new Array(10)].flatMap((_, category) =>
  [...new Array(3)].map((_, series) => ({
    series: `series_${series}`,
    category: `category_${category}`,
    value: 1 + 29 * random(),
  })),
);

function getCategory(d: PreparedDataItem) {
  return d.category;
}

function getSeriesValue(item: PreparedDataItem, key: string) {
  const value = item[key];
  return typeof value === 'number' ? value : 0;
}

type PreparedDataItem = {
  category: string;
} & { [key: string]: number | undefined };

interface Props<Category extends StringLike, Series extends StringLike>
  extends BarChartProps<Category, Series> {}

export default function StackedBarChart<
  Category extends StringLike = string,
  Series extends StringLike = string,
>(props: Props<Category, Series>) {
  const {
    data,
    colors,
    height,
    hideLegend,
    formatValue = DEFAULT_FORMATTER,
    formatSeries = DEFAULT_FORMATTER,
    formatCategory = DEFAULT_FORMATTER,
    customBarColors,
  } = props;

  const showSkeleton = isLoading(data) && getOr(data, null) == null;

  const [highlighted, setHighlighted] = useState<Highlighted>({
    category: null,
    series: null,
  });

  const [disabledSeries, setDisabledSeries] = useState<string[]>([]);

  const dataValue = useMemo(() => {
    return getOr(
      map(data, (value) => {
        return value.map((item) => {
          const series = formatSeries(item.series);
          const category = formatCategory(item.category);
          return {
            ...item,
            value: disabledSeries.includes(series) ? 0 : item.value,
            series,
            category,
          };
        });
      }),
      showSkeleton ? SKELETON_DATA : [],
    );
  }, [data, showSkeleton, formatSeries, formatCategory, disabledSeries]);

  const preparedCustomBarColors = usePreparedCustomColoring(
    data,
    customBarColors,
    showSkeleton,
    formatSeries,
    formatCategory,
  );

  const preparedColors = mapKeys(colors, (_, key) => formatSeries(key as unknown as Series));

  const colorScale = useColorScale(dataValue, preparedColors);

  const paddings = showSkeleton
    ? SKELETON_PADDINGS
    : BAR_CHART_DEFAULT_PADDINGS(Math.max(...dataValue.map((x) => x.value)));

  return (
    <DefaultChartContainer
      height={height}
      showSkeleton={showSkeleton}
      hideLegend={showSkeleton || hideLegend}
      renderChart={(renderProps) => (
        <Chart<string, string>
          {...renderProps}
          data={dataValue}
          colors={
            showSkeleton
              ? SKELETON_DATA.reduce(
                  (acc, { series }) => ({
                    ...acc,
                    [series]: COLORS_V2_SKELETON_COLOR,
                  }),
                  {},
                )
              : preparedColors
          }
          formatValue={formatValue}
          paddings={paddings}
          highlightedState={[highlighted, setHighlighted]}
          customBarColors={preparedCustomBarColors}
        />
      )}
      renderLegend={(props) => (
        <CustomLegendOrdinal<string>
          {...props}
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
              category: null,
              series: series,
            }));
          }}
          onItemMouseLeave={() => {
            setHighlighted((prevState) => ({
              ...prevState,
              category: null,
              series: null,
            }));
          }}
        />
      )}
    />
  );
}

/*
  Helpers
 */

type TooltipData =
  | {
      type: 'ITEM';
      datum: PreparedDataItem;
      key: string;
    }
  | {
      type: 'CATEGORY';
      category: string;
    };

export type ChartProps<Category extends StringLike, Series extends StringLike> = {
  colors: ColorsMap;
  data: BarChartData<Category, Series>;
  size: {
    width: number;
    height: number;
  };
  showSkeleton?: boolean;
  paddings?: Paddings;
  highlightedState: StatePair<Highlighted>;
  customBarColors?: (category: string, series: string, defaultColor: string) => string;
};

function Chart<Category extends StringLike, Series extends StringLike>(
  props: ChartProps<Category, Series> & Pick<Props<Category, Series>, 'formatValue'>,
) {
  const {
    data,
    size,
    colors,
    formatValue = DEFAULT_FORMATTER,
    showSkeleton = false,
    paddings = BAR_CHART_DEFAULT_PADDINGS(Math.max(...data.map((x) => x.value))),
    highlightedState,
    customBarColors,
  } = props;

  const colorScale = useColorScale(data, colors);
  const derivedScales = useScales(data, size, paddings);

  const [highlighted, setHighlighted] = highlightedState;
  const { xScale, yScale } = derivedScales;

  const preparedData: PreparedDataItem[] = useMemo(() => {
    const grouped = groupBy(data, (x) => {
      return x.category;
    });

    return Object.entries(grouped).map(([category, items]) =>
      items.reduce(
        (acc, item) => ({
          ...acc,
          [item.series.toString()]: item.value,
        }),
        {
          category: category,
        } as PreparedDataItem,
      ),
    );
  }, [data]);

  const series = uniq(data.map(({ series }) => series.toString()));

  const { showTooltip, hideTooltip, state } = useTooltipState<TooltipData>();

  const chartHeight = size.height - paddings.top - paddings.bottom;

  const categoryHighlightRects: (Rect & { category: Category })[] = useMemo(() => {
    return xScale.domain().map((category) => {
      const width = xScale.step();
      const x = paddings.left + (xScale(category) ?? 0) - (width * xScale.paddingInner()) / 2;
      const y = paddings.top;
      const height = chartHeight;
      return {
        category,
        width,
        height,
        x,
        y,
      };
    });
  }, [xScale, chartHeight, paddings.left, paddings.top]);

  return (
    <TooltipWrapper
      tooltipState={state}
      tooltipComponent={({ tooltipData }) =>
        tooltipData.type === 'ITEM' ? (
          <SeriesTooltip
            items={[
              {
                color: colorScale(tooltipData.key as unknown as Series),
                label: tooltipData.key,
                value: formatValue(getSeriesValue(tooltipData.datum, tooltipData.key)),
              },
            ]}
          />
        ) : (
          <DefaultChartTooltip>{tooltipData.category}</DefaultChartTooltip>
        )
      }
    >
      {({ containerRef }) => {
        return (
          <svg width={size.width} height={size.height} ref={containerRef} className={s.svg}>
            {categoryHighlightRects.map(({ category, width, height, x, y }) => (
              <rect
                className={cn(s.categoryHighlighting, {
                  [s.isHighlighted]: highlighted.category === category,
                })}
                key={category.toString()}
                x={x}
                y={y}
                height={height}
                width={width}
                onMouseLeave={() => {
                  hideTooltip();
                  setHighlighted((prevState) => ({
                    ...prevState,
                    category: null,
                    series: null,
                  }));
                }}
                onMouseMove={() => {
                  setHighlighted({
                    category: category.toString(),
                    series: null,
                  });
                  showTooltip({
                    tooltipData: {
                      type: 'CATEGORY',
                      category: category.toString(),
                    },
                    tooltipTop: y,
                    tooltipLeft: x + width,
                  });
                }}
              />
            ))}
            <Group top={paddings.top} left={paddings.left}>
              <BarStack<PreparedDataItem, string>
                data={preparedData}
                keys={series}
                value={getSeriesValue}
                x={getCategory}
                xScale={xScale}
                yScale={yScale}
                color={(series) => colorScale(series as unknown as Series)}
              >
                {(barStacks) =>
                  barStacks.map((barStack) => (
                    <React.Fragment key={`bar-stack-${barStack.index}`}>
                      {barStack.bars.map((bar) => {
                        const barCategory = bar.bar.data.category;
                        const barSeries = bar.key;
                        return (
                          <React.Fragment key={`bar-stack-${barStack.index}-${bar.index}`}>
                            <rect
                              className={cn(s.bar, {
                                [s.highlighting]:
                                  highlighted.category != null || highlighted.series != null,
                                [s.isHighlightedAccent]:
                                  highlighted.category !== barCategory ||
                                  highlighted.series === barSeries,

                                [s.isHighlighted]:
                                  highlighted.category === barCategory ||
                                  highlighted.series === barSeries,
                              })}
                              x={bar.x}
                              y={bar.y}
                              height={bar.height}
                              width={bar.width}
                              fill={
                                customBarColors
                                  ? customBarColors(
                                      barCategory.toString(),
                                      barSeries.toString(),
                                      bar.color,
                                    )
                                  : bar.color
                              }
                              onMouseLeave={() => {
                                hideTooltip();
                                setHighlighted((prevState) => ({
                                  ...prevState,
                                  category: null,
                                  series: null,
                                }));
                              }}
                              onMouseMove={(event) => {
                                setHighlighted((prevState) => ({
                                  ...prevState,
                                  category: barCategory,
                                  series: barSeries,
                                }));
                                // TooltipInPortal expects coordinates to be relative to containerRef
                                // localPoint returns coordinates relative to the nearest SVG, which
                                // is what containerRef is set to in this example.
                                const eventSvgCoords = localPoint(event);
                                showTooltip({
                                  tooltipData: {
                                    type: 'ITEM',
                                    ...bar,
                                    datum: bar.bar.data,
                                  },
                                  tooltipTop: eventSvgCoords?.y,
                                  tooltipLeft: eventSvgCoords?.x,
                                });
                              }}
                            />
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  ))
                }
              </BarStack>
              {!showSkeleton && <DefaultAxisLeft hideTicks hideAxisLine left={0} scale={yScale} />}
              <DefaultAxisBottom
                showSkeleton={showSkeleton}
                left={0}
                top={chartHeight}
                scale={xScale}
                tickLabelProps={(category) => ({
                  onMouseMove: () => {
                    setHighlighted({
                      category: category.toString(),
                      series: null,
                    });
                    const rect = categoryHighlightRects.find(
                      (x) => x.category.toString() === category.toString(),
                    );
                    if (rect) {
                      showTooltip({
                        tooltipData: {
                          type: 'CATEGORY',
                          category: category.toString(),
                        },
                        tooltipTop: rect.y,
                        tooltipLeft: rect.x + rect.width,
                      });
                    }
                  },
                  onMouseLeave: () => {
                    setHighlighted({
                      category: null,
                      series: null,
                    });
                    hideTooltip();
                  },
                })}
              />
            </Group>
          </svg>
        );
      }}
    </TooltipWrapper>
  );
}

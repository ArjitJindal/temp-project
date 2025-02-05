import { hierarchy, stratify, Treemap, treemapBinary } from '@visx/hierarchy';
import { StringLike } from '@visx/scale';
import React, { useMemo, useState } from 'react';
import { Group } from '@visx/group';
import cn from 'clsx';
import { localPoint } from '@visx/event';
import { useColorScale } from './helpers';
import s from './index.module.less';

import { TreemapData, TreemapItem } from './types';
import { AsyncResource, getOr, isLoading, map } from '@/utils/asyncResource';
import { makeRandomNumberGenerator } from '@/utils/prng';
import CustomLegendOrdinal from '@/components/charts/shared/CustomLegendOrdinal';
import SeriesTooltip from '@/components/charts/shared/SeriesTooltip';
import DefaultChartContainer from '@/components/charts/shared/DefaultChartContainer';
import { DEFAULT_FONT_STYLE } from '@/components/charts/shared/text';
import { COLORS_V2_SKELETON_COLOR } from '@/components/ui/colors';
import FixText from '@/components/charts/shared/FitText';
import { DEFAULT_FORMATTER, Formatter } from '@/components/charts/shared/formatting';
import { Highlighted } from '@/components/charts/DonutChart/helpers';
import { StatePair } from '@/utils/state';
import { TooltipWrapper, useTooltipState } from '@/components/charts/shared/TooltipWrapper';
import { DonutDataItem } from '@/components/charts/DonutChart';

const random = makeRandomNumberGenerator(999999);
const SKELETON_DATA: TreemapData<string> = [...new Array(8)].map(() => ({
  name: `name_` + [...new Array(Math.round(random() * 20))].map(() => 'x').join(''),
  value: 10 + random() * 100,
}));

export * from './types';

interface Props<Name extends StringLike> {
  data: AsyncResource<TreemapData<Name>>;
  colors: { [key: string]: string | undefined };
  height?: number;
  hideLegend?: boolean;
  formatName?: Formatter<Name>;
  formatValue?: Formatter<number>;
}

export default function TreemapChart<Name extends StringLike>(props: Props<Name>) {
  const {
    data,
    height,
    colors,
    hideLegend,
    formatName = DEFAULT_FORMATTER,
    formatValue = DEFAULT_FORMATTER,
  } = props;

  const [disabledSeries, setDisabledSeries] = useState<string[]>([]);

  const showSkeleton = isLoading(data) && getOr(data, null) == null;
  const dataValue: TreemapData<string> = getOr(
    map(data, (value) => {
      return value
        .filter((item) => item.value !== 0)
        .map((item) => {
          const name = item.name ? formatName(item.name) : '';
          return {
            name: name,
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
  data: TreemapData<Name>;
  size: { width: number; height: number };
  colors: { [key: string]: string | undefined };
  showSkeleton?: boolean;
  formatValue: (value: number) => string;
  highlightedState: StatePair<Highlighted<Name>>;
}) {
  const { data, size, colors, showSkeleton = false, formatValue, highlightedState } = props;
  const colorScale = useColorScale(data, colors);

  const [highlighted, setHighlighted] = highlightedState;

  const { showTooltip, hideTooltip, state } = useTooltipState<DonutDataItem<Name>>();

  const xMax = size.width;
  const yMax = size.height;

  const hierarchyData = useMemo(() => {
    return stratify<TreemapItem<Name>>()
      .id((d) => d.name.toString())
      .parentId((d) => (d.name.toString() === 'ROOT' ? null : 'ROOT'))([
        {
          name: 'ROOT' as unknown as Name,
          value: 0,
        },
        ...data,
      ])
      .sum((d) => d.value ?? 0);
  }, [data]);

  const root = useMemo(() => {
    return hierarchy(hierarchyData).sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [hierarchyData]);

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
        <svg
          className={cn(s.svg, showSkeleton && s.showSkeleton)}
          width={size.width}
          height={size.height}
          ref={containerRef}
        >
          <Treemap<typeof hierarchyData>
            top={0}
            root={root}
            size={[xMax, yMax]}
            tile={treemapBinary}
            round
          >
            {(treemap) => (
              <Group>
                {treemap
                  .descendants()
                  .reverse()
                  .map((node) => {
                    const nodeWidth = node.x1 - node.x0;
                    const nodeHeight = node.y1 - node.y0;
                    const item = node.data.data;
                    const color = colorScale(item.name);
                    return (
                      <Group key={`node-${item.name}`} top={node.y0} left={node.x0}>
                        {node.depth === 1 && (
                          <>
                            <rect
                              className={cn(s.block, {
                                [s.highlighting]: highlighted.name != null,
                                [s.isHighlighted]:
                                  highlighted.name?.toString() === item.name.toString(),
                              })}
                              width={nodeWidth}
                              height={nodeHeight}
                              stroke={showSkeleton ? 'white' : color}
                              fill={showSkeleton ? COLORS_V2_SKELETON_COLOR : color}
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
                            {!showSkeleton && (
                              <FixText
                                className={s.text}
                                fontStyle={DEFAULT_FONT_STYLE}
                                x={nodeWidth / 2}
                                y={nodeHeight / 2}
                                rect={{
                                  width: nodeWidth,
                                  height: nodeHeight,
                                }}
                                dominantBaseline="middle"
                                textAnchor="middle"
                              >
                                {`${item.name.toString()} (${formatValue(item.value)})`}
                              </FixText>
                            )}
                          </>
                        )}
                      </Group>
                    );
                  })}
              </Group>
            )}
          </Treemap>
        </svg>
      )}
    </TooltipWrapper>
  );
}

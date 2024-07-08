import { Line as AntLine, Tooltip } from '@ant-design/charts';

export interface LineDataItem<X, Y, Series> {
  xValue: X;
  yValue: Y;
  series?: Series;
}

export type LineData<X, Y, Series> = LineDataItem<X, Y, Series>[];

interface Props<X, Y, Series> {
  data: LineData<X, Y, Series>;
  colors: { [key: string]: string | undefined };
  height?: number;
  hideLegend?: boolean;
  dashedLinesSeries?: Series[];
  customTooltip?: Tooltip;
}

export function LineChart<Series = string, X = string>(props: Props<X, number, Series>) {
  const { data, height, colors, hideLegend, dashedLinesSeries, customTooltip } = props;
  const tooltip = customTooltip ? { tooltip: customTooltip } : {};
  return (
    <AntLine
      height={height}
      padding={'auto'}
      xField="xValue"
      yField="yValue"
      seriesField={'series'}
      animation={false}
      xAxis={{
        title: null,
        label: {
          autoRotate: true,
        },
        grid: {
          line: {
            style: {
              stroke: 'transparent',
            },
          },
        },
      }}
      yAxis={{
        title: null,
        grid: {
          line: {
            style: {
              stroke: 'transparent',
            },
          },
        },
      }}
      lineStyle={(data) => {
        if (dashedLinesSeries?.includes(data.series)) {
          return { lineDash: [4, 4] };
        }
      }}
      data={data}
      color={(x) => {
        return colors[x.series] ?? 'gray';
      }}
      legend={hideLegend ? false : undefined}
      {...tooltip}
    />
  );
}

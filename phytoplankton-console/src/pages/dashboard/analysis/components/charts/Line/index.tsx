import { Line as AntLine } from '@ant-design/charts';

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
}

export function LineChart<Series = string, X = string>(props: Props<X, number, Series>) {
  const { data, height, colors, hideLegend } = props;
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
      data={data}
      color={(x) => {
        return colors[x.series] ?? 'gray';
      }}
      legend={hideLegend ? false : undefined}
    />
  );
}

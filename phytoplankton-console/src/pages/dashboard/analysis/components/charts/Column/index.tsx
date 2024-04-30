import { Column as AntColumn } from '@ant-design/charts';
import { Annotation } from '@antv/g2plot';
import { each, groupBy } from 'lodash';
import { escapeHtml } from '@/utils/browser';
import { humanizeAuto } from '@/utils/humanize';

export interface ColumnDataItem<X, Y, Series> {
  xValue: X;
  yValue: Y;
  series?: Series;
}

export type ColumnData<X, Y, Series> = ColumnDataItem<X, Y, Series>[];

interface Props<X, Y, Series> {
  data: ColumnData<X, Y, Series>;
  colors: { [key: string]: string | undefined };
  formatY?: (value: Y) => string;
  formatX?: (value: X) => string;
  formatSeries?: (value: Series) => string;
  height?: number;
  showTotals?: boolean;
  rotateLabel?: boolean;
  hideLegend?: boolean;
  elipsisLabel?: boolean;
}

export default function Column<Series = string, X = string>(props: Props<X, number, Series>) {
  const {
    formatX,
    formatY,
    formatSeries,
    data,
    colors,
    showTotals = false,
    height,
    rotateLabel = true,
    hideLegend = false,
    elipsisLabel = false,
  } = props;

  const annotations: Annotation[] | undefined = [];
  if (showTotals) {
    each(groupBy(data, 'xValue'), (values, k) => {
      const value = values.reduce((a, b) => a + b.yValue, 0);
      annotations.push({
        type: 'text',
        position: [k, value],
        content: escapeHtml(`${value}`),
        style: {
          textAlign: 'center',
          fontSize: 14,
          fill: 'rgba(0,0,0,0.85)',
        },
        offsetY: -10,
      });
    });
  }

  return (
    <AntColumn
      animation={false}
      height={height}
      isStack={true}
      data={data}
      xField={'xValue'}
      yField={'yValue'}
      seriesField={'series'}
      color={(x) => {
        return colors[x.series] ?? 'gray';
      }}
      maxColumnWidth={100}
      xAxis={{
        label: {
          autoRotate: false,
          autoHide: true,
          rotate: rotateLabel ? -Math.PI / 6 : 0,
          offsetX: -10,
          offsetY: 10 + (rotateLabel ? 7 : 0),
          style: {
            textAlign: 'center',
            textBaseline: 'bottom',
          },
          formatter(text, _item, _index) {
            return humanizeAuto(text);
          },
          autoEllipsis: elipsisLabel,
        },
        title: null,
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
      meta={{
        xValue: {
          formatter: (value) => {
            //  required because of XSS issue inside of chart library: https://www.notion.so/flagright/Pen-Test-Fix-Cross-site-scripting-stored-62fcbe075a42476aac5963fc18e845f5?pvs=4
            return escapeHtml(formatX?.(value) ?? value);
          },
        },
        yValue: {
          formatter: (value) => {
            //  required because of XSS issue inside of chart library: https://www.notion.so/flagright/Pen-Test-Fix-Cross-site-scripting-stored-62fcbe075a42476aac5963fc18e845f5?pvs=4
            return escapeHtml(formatY?.(value.toLocaleString()) ?? value.toLocaleString());
          },
        },
        series: {
          formatter: (value) => {
            //  required because of XSS issue inside of chart library: https://www.notion.so/flagright/Pen-Test-Fix-Cross-site-scripting-stored-62fcbe075a42476aac5963fc18e845f5?pvs=4
            return escapeHtml(formatSeries?.(value) ?? value);
          },
        },
      }}
      annotations={annotations}
      legend={
        !hideLegend && {
          layout: 'horizontal',
          position: 'bottom',
          reversed: true,
          padding: [40, 0, 0, 0],
        }
      }
    />
  );
}

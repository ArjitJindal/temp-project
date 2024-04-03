import { Pie as AntPie } from '@ant-design/plots';
import { PieConfig } from '@ant-design/plots/es/components/pie';
import { escapeHtml } from '@/utils/browser';
import NoData from '@/pages/case-management-item/CaseDetails/InsightsCard/components/NoData';
import { COLORS_V2_GRAY_11 } from '@/components/ui/colors';

const ANGLE_FIELD: keyof DonutDataItem<unknown> = 'value';
const COLOR_FIELD: keyof DonutDataItem<unknown> = 'series';

export type DonutDataItem<Series> = {
  value: number;
  series: Series;
};

export type DonutData<Series> = DonutDataItem<Series>[];

interface Props<Series extends string> {
  data: DonutData<Series>;
  colors: { [key in Series]: string };
  shape?: 'CIRCLE' | 'SEMI_CIRCLE';
  legendPosition?: 'RIGHT' | 'BOTTOM';
  formatSeries?: (value: Series) => string;
}

function Donut<Series extends string>(props: Props<Series>) {
  const { data, colors, formatSeries, legendPosition = 'RIGHT', shape = 'CIRCLE' } = props;

  if (data.length === 0) {
    return <NoData />;
  }

  const legendPositionFixed: 'bottom' | 'right' = legendPosition === 'BOTTOM' ? 'bottom' : 'right';

  const config: PieConfig = {
    animation: false,
    appendPadding: 10,
    data,
    angleField: ANGLE_FIELD,
    colorField: COLOR_FIELD,
    color: (data: any) => colors[data[COLOR_FIELD]],
    radius: 1,
    innerRadius: 0.65,
    startAngle: shape === 'CIRCLE' ? 0 : Math.PI,
    endAngle: 2 * Math.PI,
    label: {
      type: 'inner',
      offset: '-50%',
      content: (item: any) => item.value,
      autoRotate: false,
      style: {
        textAlign: 'center',
        fontWeight: 600,
        fontSize: 12,
        fontFamily: 'Noto Sans',
        fill: COLORS_V2_GRAY_11,
      },
    },
    interactions: [
      {
        type: 'element-active',
      },
    ],
    pieStyle: {
      lineWidth: 0,
    },
    statistic: {
      title: undefined,
      content: {
        style: {
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
        content: '',
      },
    },
    legend: {
      position: legendPositionFixed,
    },
    meta: {
      [COLOR_FIELD]: {
        formatter: (value) => {
          return escapeHtml(formatSeries?.(value) ?? value);
        },
      },
    },
  };

  return <AntPie {...config} />;
}

export default Donut;

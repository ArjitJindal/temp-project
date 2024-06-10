import { Pie as AntPie, PieConfig } from '@ant-design/plots';
import s from './index.module.less';
import { escapeHtml } from '@/utils/browser';
import NoData from '@/pages/case-management-item/CaseDetails/InsightsCard/components/NoData';
import { COLORS_V2_SKELETON_COLOR, COLORS_V2_GRAY_11 } from '@/components/ui/colors';
import { AsyncResource, getOr, isLoading } from '@/utils/asyncResource';
import { makeRandomNumberGenerator } from '@/utils/prng';

const random = makeRandomNumberGenerator(999999);
const SKELETON_DATA: DonutData<string> = [...new Array(10)].map((_, column) => ({
  value: 1 + 29 * random(),
  series: [...new Array(4 + Math.floor(8 * random()))].map(() => '■').join('') + `--${column}`,
}));

const ANGLE_FIELD: keyof DonutDataItem<unknown> = 'value';
const COLOR_FIELD: keyof DonutDataItem<unknown> = 'series';

export type DonutDataItem<Series> = {
  value: number;
  series: Series;
};

export type DonutData<Series> = DonutDataItem<Series>[];

interface Props<Series extends string> {
  data: AsyncResource<DonutData<Series>>;
  colors: { [key in Series]: string };
  shape?: 'CIRCLE' | 'SEMI_CIRCLE';
  legendPosition?: 'RIGHT' | 'BOTTOM';
  formatSeries?: (value: Series) => string;
}

function Donut<Series extends string>(props: Props<Series>) {
  const { data, colors, formatSeries, legendPosition = 'RIGHT', shape = 'CIRCLE' } = props;
  const dataValue = getOr(data, null);
  const showSkeleton = isLoading(data) && dataValue == null;

  if (!showSkeleton && dataValue != null && dataValue.length === 0) {
    return <NoData />;
  }

  const legendPositionFixed: 'bottom' | 'right' = legendPosition === 'BOTTOM' ? 'bottom' : 'right';

  const config: PieConfig = {
    animation: false,
    appendPadding: 10,
    data: showSkeleton ? SKELETON_DATA : dataValue ?? [],
    angleField: ANGLE_FIELD,
    colorField: COLOR_FIELD,
    color: (data: any) => (showSkeleton ? COLORS_V2_SKELETON_COLOR : colors[data[COLOR_FIELD]]),
    radius: 1,
    innerRadius: 0.65,
    startAngle: shape === 'CIRCLE' ? 0 : Math.PI,
    endAngle: 2 * Math.PI,
    label: {
      type: 'inner',
      offset: '-50%',
      content: (item: any) => (showSkeleton ? '' : item.value),
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
      itemName: {
        formatter: showSkeleton
          ? (value) => {
              return value.replaceAll(/[^■]/g, '');
            }
          : undefined,
        style: {
          fill: showSkeleton ? COLORS_V2_SKELETON_COLOR : undefined,
          stroke: showSkeleton ? COLORS_V2_SKELETON_COLOR : undefined,
          lineWidth: showSkeleton ? 5 : undefined,
        },
      },
    },
    meta: {
      [COLOR_FIELD]: {
        formatter: (value) => {
          return escapeHtml(formatSeries?.(value) ?? value);
        },
      },
    },
  };

  return <AntPie className={showSkeleton && s.disabled} {...config} />;
}

export default Donut;

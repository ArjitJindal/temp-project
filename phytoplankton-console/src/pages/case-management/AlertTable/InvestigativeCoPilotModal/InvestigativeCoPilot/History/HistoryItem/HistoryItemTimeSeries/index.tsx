import { QuestionResponseTimeSeries } from '../../../types';
import { notEmpty } from '@/utils/array';
import { dayjs, DEFAULT_DATE_FORMAT } from '@/utils/dayjs';
import { ALL_CHART_COLORS } from '@/components/ui/colors';
import LineChart, { LineData } from '@/components/charts/Line';
import { success } from '@/utils/asyncResource';

interface Props {
  item: QuestionResponseTimeSeries;
}

export default function HistoryItemTimeSeries(props: Props) {
  const { item } = props;

  const data: LineData<string, string> = (item.timeseries ?? []).flatMap((seriesItem) =>
    (seriesItem.values ?? []).map((valueItem) => ({
      series: seriesItem.label || 'Value',
      yValue: valueItem.value ?? 0,
      xValue: dayjs(valueItem.time).format(DEFAULT_DATE_FORMAT),
    })),
  );

  const seriesLabels: string[] = (item.timeseries ?? [])
    .map((x) => x.label || 'Value')
    .filter(notEmpty);

  return (
    <LineChart
      data={success(data)}
      colors={seriesLabels.reduce(
        (acc, series, i) => ({ ...acc, [series]: ALL_CHART_COLORS[i % ALL_CHART_COLORS.length] }),
        {},
      )}
      height={200}
      hideLegend={seriesLabels.length < 2}
    />
  );
}

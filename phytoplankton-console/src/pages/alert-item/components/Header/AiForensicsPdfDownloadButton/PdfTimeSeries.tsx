import React from 'react';
import s from './index.module.less';
import { QuestionResponseTimeSeries } from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';
import LineChart, { LineData } from '@/components/charts/Line';
import { notEmpty } from '@/utils/array';
import { ALL_CHART_COLORS } from '@/components/ui/colors';
import { success } from '@/utils/asyncResource';
import { dayjs, DEFAULT_DATE_FORMAT } from '@/utils/dayjs';

interface Props {
  item: QuestionResponseTimeSeries;
}

const PdfTimeSeries: React.FC<Props> = ({ item }) => {
  if (!item.timeseries || item.timeseries.length === 0) {
    return <div className={s.noData}>No time series data available</div>;
  }

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
    <div className={s.chartContainer}>
      <LineChart
        data={success(data)}
        colors={seriesLabels.reduce(
          (acc, series, i) => ({ ...acc, [series]: ALL_CHART_COLORS[i % ALL_CHART_COLORS.length] }),
          {},
        )}
        height={200}
        hideLegend={seriesLabels.length < 2}
      />
    </div>
  );
};

export default PdfTimeSeries;

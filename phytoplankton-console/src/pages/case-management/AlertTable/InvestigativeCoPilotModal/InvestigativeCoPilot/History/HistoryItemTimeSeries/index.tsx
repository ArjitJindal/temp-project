import React from 'react';
import { QuestionResponseTimeSeries } from '../../types';
import HistoryItemBase from '../HistoryItemBase';
import Column, { ColumnData } from '@/pages/dashboard/analysis/components/charts/Column';
import { notEmpty } from '@/utils/array';
import { ALL_CHART_COLORS } from '@/components/ui/colors';
import { dayjs, DEFAULT_DATE_FORMAT } from '@/utils/dayjs';

interface Props {
  item: QuestionResponseTimeSeries;
}

export default function HistoryItemTimeSeries(props: Props) {
  const { item } = props;

  const data: ColumnData<string, number, string> = (item.timeseries ?? []).flatMap((seriesItem) =>
    (seriesItem.values ?? []).map((valueItem) => ({
      series: seriesItem.label ?? 'N/A',
      yValue: valueItem.value ?? 0,
      xValue: dayjs(valueItem.time).format(DEFAULT_DATE_FORMAT),
    })),
  );

  const seriesLabels: string[] = (item.timeseries ?? []).map((x) => x.label).filter(notEmpty);

  return (
    <HistoryItemBase item={item}>
      <Column
        data={data}
        colors={seriesLabels.reduce(
          (acc, series, i) => ({ ...acc, [series]: ALL_CHART_COLORS[i % ALL_CHART_COLORS.length] }),
          {},
        )}
        height={200}
      />
    </HistoryItemBase>
  );
}

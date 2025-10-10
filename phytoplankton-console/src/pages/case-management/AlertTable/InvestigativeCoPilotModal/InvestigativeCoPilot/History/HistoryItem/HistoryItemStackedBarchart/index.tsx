import React from 'react';
import { QuestionResponseStackedBarchart } from '../../../types';
import BarChart, { BarChartData } from '@/components/charts/BarChart';
import { notEmpty } from '@/utils/array';
import { ALL_CHART_COLORS } from '@/components/ui/colors';
import { success } from '@/utils/asyncResource';

interface Props {
  item: QuestionResponseStackedBarchart;
}

export default function HistoryItemStackedBarchart(props: Props) {
  const { item } = props;

  const data: BarChartData<string, string> = (item.series ?? []).flatMap((seriesItem) =>
    (seriesItem.values ?? []).map((valueItem) => ({
      series: seriesItem.label ?? 'N/A',
      value: valueItem.y ?? 0,
      category: valueItem.x ?? 'N/A',
    })),
  );

  const seriesLabels: string[] = (item.series ?? []).map((x) => x.label).filter(notEmpty);

  return (
    <BarChart
      grouping={'STACKED'}
      data={success(data)}
      colors={seriesLabels.reduce(
        (acc, series, i) => ({ ...acc, [series]: ALL_CHART_COLORS[i % ALL_CHART_COLORS.length] }),
        {},
      )}
      height={200}
    />
  );
}

import React from 'react';
import { QuestionResponseBarchart } from '../../../types';
import { notEmpty } from '@/utils/array';
import { ALL_CHART_COLORS } from '@/components/ui/colors';
import { success } from '@/utils/asyncResource';
import BarChart, { BarChartData } from '@/components/charts/BarChart';

interface Props {
  item: QuestionResponseBarchart;
}

export default function HistoryItemBarchart(props: Props) {
  const { item } = props;

  const data: BarChartData<string, string> = (item.values ?? []).map((valueItem) => ({
    series: valueItem.x ?? 'N/A',
    value: valueItem.y ?? 0,
    category: valueItem.x ?? 'N/A',
  }));

  const seriesLabels: string[] = (item.values ?? []).map(({ x }) => x).filter(notEmpty);

  return (
    <BarChart
      data={success(data)}
      colors={seriesLabels.reduce(
        (acc, series, i) => ({ ...acc, [series]: ALL_CHART_COLORS[i % ALL_CHART_COLORS.length] }),
        {},
      )}
      height={200}
      hideLegend={true}
    />
  );
}

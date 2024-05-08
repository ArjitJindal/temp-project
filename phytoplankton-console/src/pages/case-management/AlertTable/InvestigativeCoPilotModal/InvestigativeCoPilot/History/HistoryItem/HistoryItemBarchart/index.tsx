import React from 'react';
import { QuestionResponseBarchart } from '../../../types';
import Column, { ColumnData } from '@/pages/dashboard/analysis/components/charts/Column';
import { notEmpty } from '@/utils/array';
import { ALL_CHART_COLORS } from '@/components/ui/colors';
import { success } from '@/utils/asyncResource';

interface Props {
  item: QuestionResponseBarchart;
}

export default function HistoryItemBarchart(props: Props) {
  const { item } = props;

  const data: ColumnData<string, number, string> = (item.values ?? []).map((valueItem) => ({
    series: valueItem.x ?? 'N/A',
    yValue: valueItem.y ?? 0,
    xValue: valueItem.x ?? 'N/A',
  }));

  const seriesLabels: string[] = (item.values ?? []).map(({ x }) => x).filter(notEmpty);

  return (
    <Column
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

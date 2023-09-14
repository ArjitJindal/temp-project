import React from 'react';
import { QuestionResponseStackedBarchart } from '../../types';
import HistoryItemBase from '../HistoryItemBase';
import Column, { ColumnData } from '@/pages/dashboard/analysis/components/charts/Column';
import { notEmpty } from '@/utils/array';
import { ALL_CHART_COLORS } from '@/components/ui/colors';

interface Props {
  item: QuestionResponseStackedBarchart;
}

export default function HistoryItemStackedBarchart(props: Props) {
  const { item } = props;

  const data: ColumnData<string, number, string> = (item.series ?? []).flatMap((seriesItem) =>
    (seriesItem.values ?? []).map((valueItem) => ({
      series: seriesItem.label ?? 'N/A',
      yValue: valueItem.y ?? 0,
      xValue: valueItem.x ?? 'N/A',
    })),
  );

  const seriesLabels: string[] = (item.series ?? []).map((x) => x.label).filter(notEmpty);

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

import { useMemo } from 'react';
import {
  CalculatedParams,
  DataItem,
  Series,
} from '@/pages/case-management-item/CaseDetails/InsightsCard/TransactionsSelector/Chart/types';
import { calculateScaleMax } from '@/utils/charts';

export const TOP_PADDING = 10;
export const BOTTOM_PADDING = 60;
export const LEFT_PADDING = 80;
export const RIGHT_PADDING = 40;
export const MAX_COLUMN_WIDTH = 150;
export const Y_TICKS_COUNT = 5;

export function useColumnParams(
  data: DataItem[],
  seriesList: Series[],
  usefulWidth: number,
): CalculatedParams {
  const seriesCount = seriesList.length;
  const widthSpace = usefulWidth / seriesCount;
  const gap = widthSpace > 20 ? 10 : 1;
  const columnWidth = Math.min(
    (usefulWidth - gap * (seriesCount - 1)) / seriesCount,
    MAX_COLUMN_WIDTH,
  );
  const xLabelFontSize = widthSpace > 40 ? 14 : 10;

  const max = calculateScaleMax(
    data
      .map((dataItem) => Object.values(dataItem.values).reduce((acc, x) => acc + x, 0))
      .reduce((acc, x) => Math.max(acc, x), 1),
  );

  return useMemo(() => {
    return {
      xLabelFontSize,
      yMax: max,
      gap,
      columnWidth,
    };
  }, [max, gap, columnWidth, xLabelFontSize]);
}

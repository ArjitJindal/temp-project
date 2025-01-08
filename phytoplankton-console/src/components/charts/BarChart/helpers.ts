import { scaleOrdinal, StringLike } from '@visx/scale';
import { ScaleOrdinal } from 'd3-scale';
import { useMemo } from 'react';
import { uniq } from 'lodash';
import { BarChartData, ColorsMap } from '@/components/charts/BarChart/types';
import { ALL_CHART_COLORS } from '@/components/ui/colors';
import { AsyncResource, getOr } from '@/utils/asyncResource';
import { Formatter } from '@/components/charts/shared/formatting';

export const SKELETON_TICK_COMPONENT = () => {
  return null;
};

export function useColorScale<Category extends StringLike, Series extends StringLike>(
  data: BarChartData<Category, Series>,
  colors: ColorsMap,
): ScaleOrdinal<Series, string> {
  return useMemo(() => {
    const series = uniq(data.map((x) => x.series));
    const colorScale = scaleOrdinal<Series, string>({
      domain: series,
      range: series.map((series, i) => {
        return colors[series.toString()] ?? ALL_CHART_COLORS[i % ALL_CHART_COLORS.length];
      }),
    });

    return colorScale;
  }, [data, colors]);
}

export function usePreparedCustomColoring<Category extends StringLike, Series extends StringLike>(
  data: AsyncResource<BarChartData<Category, Series>>,
  customBarColors:
    | ((category: Category, series: Series, defaultColor: string) => string)
    | undefined,
  showSkeleton: boolean,
  formatSeries: Formatter<Series>,
  formatCategory: Formatter<Category>,
) {
  return useMemo(() => {
    // We need to be able to get an original series/category by the formatted
    // text, that is why I create a back-mapping object
    const originalSeriesMap: { [key: string]: Series } = {};
    const originalCategoryMap: { [key: string]: Category } = {};
    for (const item of getOr(data, [])) {
      originalSeriesMap[formatSeries(item.series)] = item.series;
      originalCategoryMap[formatCategory(item.category)] = item.category;
    }
    if (customBarColors && !showSkeleton) {
      return (category, series, defaultColor) => {
        return customBarColors(
          originalCategoryMap[category],
          originalSeriesMap[series],
          defaultColor,
        );
      };
    }
    return undefined;
  }, [data, customBarColors, showSkeleton, formatSeries, formatCategory]);
}

export interface Highlighted {
  category: string | null;
  series: string | null;
}

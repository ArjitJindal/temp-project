import { scaleOrdinal, StringLike } from '@visx/scale';
import { ScaleOrdinal } from 'd3-scale';
import { useMemo } from 'react';
import { uniq } from 'lodash';
import { BarChartData, ColorsMap } from '@/components/charts/BarChart/types';
import { ALL_CHART_COLORS } from '@/components/ui/colors';
import { AsyncResource, getOr } from '@/utils/asyncResource';
import { Formatter } from '@/components/charts/shared/formatting';

export const SKELETON_TICK_COMPONENT = () => null;

export enum ChartParts {
  BAR = 'bar',
  AXIS = 'axis',
  SPACE = 'space',
}

export enum ToolTipOptions {
  VALUE = 'VALUE',
  CATEGORY = 'CATEGORY',
}

export interface EntityConfiguration {
  shouldRender: boolean;
  renderWholeGroupData: boolean;
  toolTipType: ToolTipOptions;
}

export type BarEntityConfiguration = Omit<EntityConfiguration, 'toolTipType'>;
export type AxisEntityConfiguration = EntityConfiguration;
export type SpaceEntityConfiguration = Omit<EntityConfiguration, 'renderWholeGroupData'>;

type ConfigurationMap = {
  [ChartParts.BAR]: BarEntityConfiguration;
  [ChartParts.AXIS]: AxisEntityConfiguration;
  [ChartParts.SPACE]: SpaceEntityConfiguration;
};

const DEFAULT_CONFIGURATIONS = {
  [ChartParts.BAR]: {
    shouldRender: true,
    renderWholeGroupData: false,
    defaultToolTip: ToolTipOptions.VALUE,
  },
  [ChartParts.AXIS]: {
    shouldRender: true,
    renderWholeGroupData: false,
    defaultToolTip: ToolTipOptions.CATEGORY,
  },
  [ChartParts.SPACE]: {
    shouldRender: true,
    renderWholeGroupData: false,
    defaultToolTip: ToolTipOptions.CATEGORY,
  },
};

export type Configuration = {
  [K in ChartParts]: ConfigurationMap[K];
};

export const getEntityConfiguration = <T extends ChartParts>(
  type: T,
  configuration: Partial<EntityConfiguration> = {},
): ConfigurationMap[T] =>
  ({
    ...DEFAULT_CONFIGURATIONS[type],
    ...configuration,
  } as ConfigurationMap[T]);

export const DEFAULT_CHART_CONFIGURATION = Object.fromEntries(
  Object.values(ChartParts).map((part) => [part, getEntityConfiguration(part)]),
) as Configuration;

export interface Highlighted {
  category: string | null;
  series: string | null;
}

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

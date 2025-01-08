import { scaleOrdinal, StringLike } from '@visx/scale';
import { ScaleOrdinal } from 'd3-scale';
import { useMemo } from 'react';
import { uniq } from 'lodash';
import { DonutData } from './types';
import { ColorsMap } from '@/components/charts/BarChart';
import { ALL_CHART_COLORS } from '@/components/ui/colors';

export interface Highlighted<Name extends StringLike> {
  name: Name | null;
}

export const DONUT_THICKNESS = 100;

export function useColorScale<Name extends StringLike>(
  data: DonutData<Name>,
  colors: ColorsMap,
): ScaleOrdinal<Name, string> {
  return useMemo(() => {
    const series = uniq(data.map((x) => x.name ?? ('' as unknown as Name)));
    return scaleOrdinal<Name, string>({
      domain: series,
      range: series.map((series, i) => {
        return (
          (series ? colors[series?.toString()] : undefined) ??
          ALL_CHART_COLORS[i % ALL_CHART_COLORS.length]
        );
      }),
    });
  }, [data, colors]);
}

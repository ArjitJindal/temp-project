import { scaleBand, scaleLinear, StringLike } from '@visx/scale';
import { useMemo } from 'react';
import { groupBy, sum } from 'lodash';
import { ScaleBand, ScaleLinear } from 'd3-scale';
import { BarChartData } from '@/components/charts/BarChart';
import { Paddings } from '@/components/charts/shared/helpers';

export type DerivedScales<Category extends StringLike> = {
  xScale: ScaleBand<Category>;
  yScale: ScaleLinear<number, number>;
};

export function useScales<Category extends StringLike, Series extends StringLike>(
  data: BarChartData<Category, Series>,
  size: { width: number; height: number } | null,
  paddings: Paddings,
): DerivedScales<Category> {
  const { width: fullWidth, height: fullHeight } = size ?? { width: 0, height: 0 };
  const width = fullWidth - paddings.left - paddings.right;
  const height = fullHeight - paddings.top - paddings.bottom;

  return useMemo(() => {
    const totals = Object.entries(groupBy(data, (x) => x.category)).map(([_, values]) =>
      sum(values.map((item) => item.value)),
    );

    const xScale = scaleBand<Category>({
      domain: data.map((item) => item.category),
      padding: 0.2,
      range: [0, width],
      round: true,
    });

    const yScale = scaleLinear<number>({
      domain: [Math.min(0, ...totals), Math.max(1, ...totals)],
      nice: true,
      range: [height, 0],
    });

    return { xScale, yScale };
  }, [data, width, height]);
}

export const DEFAULT_PADDINGS: Paddings = { top: 16, right: 16, bottom: 64, left: 32 };

export const SKELETON_PADDINGS: Paddings = { top: 0, right: 0, bottom: 0, left: 0 };

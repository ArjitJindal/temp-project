import { scaleBand, scaleLinear, StringLike } from '@visx/scale';
import { useMemo } from 'react';
import { ScaleBand, ScaleLinear } from 'd3-scale';

import { BarChartData } from '../types';
import { Paddings } from '@/components/charts/shared/helpers';

export type DerivedScales<Category extends StringLike, Series extends StringLike> = {
  x0Scale: ScaleBand<Category>;
  x1Scale: ScaleBand<Series>;
  yScale: ScaleLinear<number, number>;
};

export function useDataScales<Category extends StringLike, Series extends StringLike>(
  data: BarChartData<Category, Series>,
  size: { width: number; height: number } | null,
  paddings: Paddings,
): DerivedScales<Category, Series> {
  const { width: fullWidth, height: fullHeight } = size ?? { width: 0, height: 0 };

  const width = fullWidth - paddings.left - paddings.right;
  const height = fullHeight - paddings.top - paddings.bottom;

  return useMemo(() => {
    const x0Scale = scaleBand<Category>({
      domain: data.map((item) => item.category),
      range: [0, width],
      round: true,
      padding: 0.2,
    });

    const x1Scale = scaleBand<Series>({
      domain: data.map((item) => item.series),
      range: [0, x0Scale.bandwidth()],
      round: true,
      padding: 0.2,
    });

    const yScale = scaleLinear<number>({
      domain: [
        Math.min(0, ...data.map(({ value }) => value)),
        Math.max(1, ...data.map(({ value }) => value)),
      ],
      range: [height, 0],
      nice: true,
    });

    return { x0Scale, x1Scale, yScale };
  }, [data, width, height]);
}

export const SKELETON_PADDINGS: Paddings = { top: 0, right: 0, bottom: 0, left: 0 };

export interface Highlighted {
  category: string | null;
  series: string | null;
}

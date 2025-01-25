import { scaleBand, scaleLinear, StringLike } from '@visx/scale';
import { ScaleBand, ScaleLinear } from 'd3-scale';

import { BarChartData } from '../types';
import { adjustScalesAndPaddings, Paddings } from '@/components/charts/shared/helpers';
import { useDeepEqualMemo } from '@/utils/hooks';

export type DerivedScales<Category extends StringLike, Series extends StringLike> = {
  x0Scale: ScaleBand<Category>;
  x1Scale: ScaleBand<Series>;
  yScale: ScaleLinear<number, number>;
};

export function calcScales<Category extends StringLike, Series extends StringLike>(
  data: BarChartData<Category, Series>,
  size: { width: number; height: number } | null,
  paddings: Paddings,
): DerivedScales<Category, Series> {
  const { width: fullWidth, height: fullHeight } = size ?? { width: 0, height: 0 };

  const width = fullWidth - paddings.left - paddings.right;
  const height = fullHeight - paddings.top - paddings.bottom;

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
}

export function useScales<Category extends StringLike, Series extends StringLike>(
  data: BarChartData<Category, Series>,
  size: { width: number; height: number } | null,
  initialPaddings: Paddings,
): {
  scales: DerivedScales<Category, Series>;
  paddings: Paddings;
} {
  return useDeepEqualMemo(() => {
    const { scales, paddings } = adjustScalesAndPaddings<
      Category,
      DerivedScales<Category, Series> & {
        xScale: ScaleBand<Category>;
      }
    >(initialPaddings, (paddings) => {
      const scales = calcScales<Category, Series>(data, size, paddings);
      return {
        ...scales,
        xScale: scales.x0Scale,
      };
    });

    return {
      paddings: paddings,
      scales: {
        x0Scale: scales.x0Scale,
        x1Scale: scales.x1Scale,
        yScale: scales.yScale,
      },
    };
  }, [data, size, initialPaddings]);
}

export const SKELETON_PADDINGS: Paddings = { top: 0, right: 0, bottom: 0, left: 0 };

export interface Highlighted {
  category: string | null;
  series: string | null;
}

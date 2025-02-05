import { scaleLinear, scaleOrdinal, StringLike, scalePoint } from '@visx/scale';
import { ScaleLinear, ScaleOrdinal, ScalePoint } from 'd3-scale';
import { useMemo } from 'react';
import { uniq } from 'lodash';
import { LineData } from './types';
import { ColorsMap } from '@/components/charts/BarChart';

import { adjustScalesAndPaddings, Paddings } from '@/components/charts/shared/helpers';
import { ALL_CHART_COLORS } from '@/components/ui/colors';
import { useDeepEqualMemo } from '@/utils/hooks';

export type DataScales<X extends StringLike> = {
  xScale: ScalePoint<X>;
  yScale: ScaleLinear<number, number>;
};

export interface TooltipData<X extends StringLike> {
  xValue: X;
}

export function useColorScale<X extends StringLike, Series extends StringLike>(
  data: LineData<X, Series>,
  colors: ColorsMap,
): ScaleOrdinal<Series, string> {
  return useMemo(() => {
    const series = uniq(data.map((x) => x.series ?? ('' as unknown as Series)));
    const colorScale = scaleOrdinal<Series, string>({
      domain: series,
      range: series.map((series, i) => {
        return (
          (series ? colors[series?.toString()] : undefined) ??
          ALL_CHART_COLORS[i % ALL_CHART_COLORS.length]
        );
      }),
    });

    return colorScale;
  }, [data, colors]);
}

export function calcScales<X extends StringLike, Series extends StringLike>(
  data: LineData<X, Series>,
  size: { width: number; height: number } | null,
  paddings: Paddings,
): DataScales<X> {
  const { width: fullWidth, height: fullHeight } = size ?? { width: 0, height: 0 };

  const width = fullWidth - paddings.left - paddings.right;
  const height = fullHeight - paddings.top - paddings.bottom;

  const xMax = width;
  const yMax = height;

  const xScale = scalePoint<X>({
    domain: data.map((item) => item.xValue),
    padding: 0.2,
    range: [0, xMax],
    round: true,
  });

  const yScale = scaleLinear<number>({
    domain: [
      Math.min(0, ...data.map((item) => item.yValue)),
      Math.max(1, ...data.map((item) => item.yValue)),
    ],
    range: [yMax, 0],
    nice: true,
  });

  return { xScale, yScale };
}

export function useScales<X extends StringLike, Series extends StringLike>(
  data: LineData<X, Series>,
  size: { width: number; height: number } | null,
  initialPaddings: Paddings,
): {
  scales: DataScales<X>;
  paddings: Paddings;
} {
  return useDeepEqualMemo(() => {
    return adjustScalesAndPaddings<X, DataScales<X>>(initialPaddings, (paddings) => {
      return calcScales<X, Series>(data, size, paddings);
    });
  }, [data, size, initialPaddings]);
}

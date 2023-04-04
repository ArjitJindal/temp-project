import { useMemo } from 'react';
import { CalculatedParams } from '../types';
import { Data } from './types';
import { calculateScaleMax } from '@/utils/charts';

export function useCalculatedParams(data: Data): CalculatedParams {
  return useMemo(() => {
    const max = calculateScaleMax(
      data.reduce(
        (acc, { maximum, minimum, median, average }) =>
          Math.max(acc, maximum ?? 0, minimum ?? 0, median ?? 0, average ?? 0),
        0,
      ),
    );
    return {
      yMax: max,
    };
  }, [data]);
}

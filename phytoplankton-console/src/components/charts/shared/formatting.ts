import { NumberLike } from '@visx/scale';
import { formatNumber } from '@/utils/number';

export type Formatter<Series> = (value: Series) => string;

export const DEFAULT_FORMATTER: Formatter<unknown> = (x) => `${x}`;
export const DEFAULT_NUMBER_FORMATTER: Formatter<NumberLike> = (x) => {
  return formatNumber(x.valueOf(), { keepDecimals: true });
};

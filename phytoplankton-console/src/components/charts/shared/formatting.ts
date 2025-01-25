import { NumberLike } from '@visx/scale';

export type Formatter<Series> = (value: Series) => string;

export const DEFAULT_FORMATTER: Formatter<unknown> = (x) => `${x}`;
export const DEFAULT_NUMBER_FORMATTER: Formatter<NumberLike> = (x) => x.toLocaleString();

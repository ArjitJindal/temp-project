export type Formatter<Series> = (value: Series) => string;

export const DEFAULT_FORMATTER: Formatter<unknown> = (x) => `${x}`;

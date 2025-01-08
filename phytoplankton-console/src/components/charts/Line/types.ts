import { StringLike } from '@visx/scale';

export interface LineDataItem<X extends StringLike, Series extends StringLike> {
  xValue: X;
  yValue: number;
  series?: Series;
}

export type LineData<X extends StringLike, Series extends StringLike> = LineDataItem<X, Series>[];

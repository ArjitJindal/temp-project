import { StringLike } from '@visx/scale';

export interface DonutDataItem<Name extends StringLike = string> {
  name: Name;
  value: number;
}

export type DonutData<Name extends StringLike = string> = DonutDataItem<Name>[];

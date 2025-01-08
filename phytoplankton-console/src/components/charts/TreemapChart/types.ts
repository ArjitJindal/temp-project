import { StringLike } from '@visx/scale';

export interface TreemapItem<Name extends StringLike = string> {
  name: Name;
  value: number;
}

export type TreemapData<Name extends StringLike = string> = TreemapItem<Name>[];

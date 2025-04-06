import { StringLike } from '@visx/scale';

export interface BarDataItem<
  Category extends StringLike = string,
  Series extends StringLike = string,
> {
  category: Category;
  series: Series;
  value: number;
}

export type BarChartData<
  Category extends StringLike = string,
  Series extends StringLike = string,
> = BarDataItem<Category, Series>[];

export type ColorsMap = {
  [key: string]: string | undefined;
};

export type GroupBy = 'VALUE' | 'TIME';

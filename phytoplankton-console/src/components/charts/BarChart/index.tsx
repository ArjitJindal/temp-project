import { StringLike } from '@visx/scale';
import { BarChartData, ColorsMap } from './types';
import StackedBarChart from './StackedBarChart';
import GroupedBarChart from './GroupedBarChart';
import { Configuration } from './helpers';
import { AsyncResource } from '@/utils/asyncResource';
import { neverThrow } from '@/utils/lang';
import {
  DEFAULT_FORMATTER,
  DEFAULT_NUMBER_FORMATTER,
  Formatter,
} from '@/components/charts/shared/formatting';

export * from './types';
// type BarOrientation = 'VERTICAL' | 'HORIZONTAL';
type BarOrientation = 'VERTICAL';
export type BarGrouping = 'GROUPED' | 'STACKED';

export const DEFAULT_GROUPING: BarGrouping = 'GROUPED';
export const DEFAULT_ORIENTATION: BarOrientation = 'VERTICAL';

export interface Props<Category extends StringLike, Series extends StringLike> {
  data: AsyncResource<BarChartData<Category, Series>>;
  colors: ColorsMap;
  height?: number;
  orientation?: BarOrientation;
  grouping?: BarGrouping;
  hideLegend?: boolean;
  rotateLabel?: boolean;
  customBarColors?: (category: Category, series: Series, defaultColor: string) => string;
  formatSeries?: Formatter<Series>;
  formatCategory?: Formatter<Category>;
  formatValue?: Formatter<number>;
  configuration?: Configuration;
}

export default function BarChart<
  Category extends StringLike = string,
  Series extends StringLike = string,
>(props: Props<Category, Series>) {
  const {
    rotateLabel,
    formatValue = DEFAULT_NUMBER_FORMATTER,
    formatSeries = DEFAULT_FORMATTER,
    formatCategory = DEFAULT_FORMATTER,
    grouping = DEFAULT_GROUPING,
    orientation = DEFAULT_ORIENTATION,
    ...rest
  } = props;

  if (rotateLabel != null) {
    console.warn(`rotateLabel is not supported yet`);
  }

  if (grouping === 'STACKED') {
    return (
      <StackedBarChart
        formatValue={formatValue}
        formatSeries={formatSeries}
        formatCategory={formatCategory}
        {...rest}
      />
    );
  }
  if (grouping === 'GROUPED') {
    return (
      <GroupedBarChart
        formatValue={formatValue}
        formatSeries={formatSeries}
        formatCategory={formatCategory}
        grouping={grouping}
        {...rest}
      />
    );
  }

  throw neverThrow(
    grouping,
    `Bar with orientation ${orientation} and grouping ${grouping} is not supported yet`,
  );
}

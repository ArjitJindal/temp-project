import React from 'react';
import { DeepKeys, DeepValue } from '@tanstack/react-table';
import _ from 'lodash';
import { AsyncResource } from '@/utils/asyncResource';
import { PaginatedData, PaginationParams } from '@/utils/queries/hooks';
import { Option } from '@/components/library/Select';

/*
  Actions
 */
export type SelectionActionProps<Item, Params extends object | unknown> = {
  selectedIds: string[];
  selectedItems: Record<string, Item>;
  params: Params;
  setParams: (cb: (oldState: AllParams<Params>) => AllParams<Params>) => void;
  onResetSelection: () => void;
};

export type SelectionAction<Item, Params extends object | unknown> = (
  props: SelectionActionProps<Item, Params>,
) => React.ReactNode;

/*
  Params
 */
export type SortOrder = 'descend' | 'ascend' | null;

export type SortingParamsItem = [string, SortOrder];

export interface SortingParams {
  sort: SortingParamsItem[];
}

export interface CommonParams extends PaginationParams, SortingParams {}

export type AllParams<Params> = Params & CommonParams;

/*
  Table data types
*/

export type TableDataSimpleItem<T> = T;

export type TableDataMultiRowsItem<T> = {
  spanBy: FieldAccessor<T>[];
  rows: T[];
};

export type TableDataItem<T> = TableDataSimpleItem<T> | TableDataMultiRowsItem<T>;

export type TableData<T> = PaginatedData<TableDataItem<T>>;

export function isMultiRows<T>(value: TableDataItem<T>): value is TableDataMultiRowsItem<T> {
  const result: TableDataMultiRowsItem<T> = value as TableDataMultiRowsItem<T>;
  return 'spanBy' in result && 'rows' in result;
}

/*
  Table item passed to columns with metadata about row
 */
export type TableRow<T> = {
  spanBy: FieldAccessor<T>[];
  rowIndex: number;
  itemIndex: number;
  content: T;
  rowsCount: number;
  isFirstRow: boolean;
  isLastRow: boolean;
};

/*
  Column definitions
 */
export type SizingMode = 'FULL_WIDTH' | 'SCROLL';

interface ColumnDataTypeEditing<Value> {
  isSupported: boolean;
  onChange: (newValue: Value | undefined) => void;
  statusRes: AsyncResource<Value | undefined>;
}

export interface ColumnDataType<Value, Item = unknown> {
  render?: (
    value: Value | undefined,
    editing: ColumnDataTypeEditing<Value>,
    item: Item,
  ) => JSX.Element;
  stringify?: (value: Value | undefined, item: Item) => string; // can be used for export // todo: make it optional
  defaultWrapMode?: 'WRAP' | 'OVERFLOW';
  autoFilterDataType?: AutoFilterDataType;
}

export type FieldAccessor<Item> = DeepKeys<Item>;

export interface BaseColumn {
  id?: string;
  title: string;
  tooltip?: string;
  icon?: React.ReactNode;
  defaultWidth?: number;
}

export interface GroupColumn<Item extends object> extends BaseColumn {
  children: TableColumn<Item>[];
}

export interface DisplayColumn<Item extends object> extends BaseColumn {
  render: (item: Item) => React.ReactNode;
}

export interface DataColumn extends BaseColumn {
  subtitle?: string;
  children?: never;
  sorting?: boolean | 'desc'; // false by default
  filtering?: boolean; // true by default
  exporting?: boolean; // true by default
  hideInTable?: boolean; // todo: do we need this?
}

export interface SimpleColumn<Item extends object, Accessor extends FieldAccessor<Item>>
  extends DataColumn {
  key: Accessor;
  type?: ColumnDataType<NonNullable<DeepValue<Item, Accessor>>, Item>;
  showFilterByDefault?: boolean;
}

export interface DerivedColumn<Item extends object, Value = unknown> extends DataColumn {
  value: (item: Item) => Value | undefined;
  type?: ColumnDataType<Value, Item>;
}

export type LeafColumn<T extends object> =
  | SimpleColumn<T, FieldAccessor<T>>
  | DerivedColumn<T>
  | DisplayColumn<T>;

export type TableColumn<T extends object> = GroupColumn<T> | LeafColumn<T>;

export function isSimpleColumn<T extends object>(
  column: TableColumn<T>,
): column is SimpleColumn<T, FieldAccessor<T>> {
  return !isDisplayColumn<T>(column) && !isDerivedColumn<T>(column) && !isGroupColumn<T>(column);
}

export function isDisplayColumn<T extends object>(
  column: TableColumn<T>,
): column is DisplayColumn<T> {
  return 'render' in column;
}

export function isDerivedColumn<T extends object>(
  column: TableColumn<T>,
): column is DerivedColumn<T> {
  return 'value' in column;
}

export function isGroupColumn<T extends object>(column: TableColumn<T>): column is GroupColumn<T> {
  return 'children' in column;
}

export function isLeafColumn<T extends object>(column: TableColumn<T>): column is LeafColumn<T> {
  return isSimpleColumn<T>(column) || isDisplayColumn<T>(column) || isDerivedColumn<T>(column);
}

export function flatColumns<Item extends object>(columns: TableColumn<Item>[]): LeafColumn<Item>[] {
  return columns.flatMap((column) =>
    isLeafColumn<Item>(column) ? [column] : flatColumns<Item>(column.children),
  );
}

export function getColumnId<Item extends object>(column: TableColumn<Item>): string {
  if (isSimpleColumn<Item>(column)) {
    return column.id ?? (column.key as string);
  }
  return column.id ?? column.title;
}

export function applyFieldAccessor<
  Item,
  Accessor extends FieldAccessor<Item> = FieldAccessor<unknown>,
>(item: Item, accessor: Accessor): DeepValue<Item, Accessor> {
  return _.get(item, accessor);
}

/*
  Filters
 */
export interface BaseFilter {
  key: string; // todo: rename to param?
  title: React.ReactNode;
  icon?: React.ReactNode;
  showFilterByDefault?: boolean;
}

export type ExtraFilterRendererProps<Params extends object | unknown> = {
  params: Params;
  setParams: (cb: (oldState: AllParams<Params>) => AllParams<Params>) => void;
};

export type ExtraFilterRenderer<Params extends object | unknown> = (
  props: ExtraFilterRendererProps<Params>,
) => React.ReactNode;

export interface ExtraFilter<Params extends object | unknown> extends BaseFilter {
  kind?: 'EXTRA';
  renderer: ExtraFilterRenderer<Params> | AutoFilterDataType | undefined;
}

export function isExtraFilter<Params extends object | unknown>(
  filter: Filter<Params>,
): filter is ExtraFilter<Params> {
  return filter.kind == null || filter.kind === 'EXTRA';
}

export type AutoFilterDataType =
  | { kind: 'string' }
  | { kind: 'number'; max?: number; min?: number; step?: number }
  | { kind: 'dateRange' }
  | { kind: 'dateTimeRange' }
  | {
      kind: 'select';
      options: Option<string>[];
      mode: 'SINGLE' | 'MULTIPLE' | 'TAGS';
      displayMode: 'select' | 'list';
    };

export interface AutoFilter extends BaseFilter {
  kind: 'AUTO';
  dataType: AutoFilterDataType;
}

export function isAutoFilter<Params extends object | unknown>(
  filter: Filter<Params>,
): filter is AutoFilter {
  return filter.kind === 'AUTO';
}

export type Filter<Params extends object | unknown> = AutoFilter | ExtraFilter<Params>;

/*
  Tools
 */
export type ToolRenderer = () => React.ReactNode;

/*
  Ref type
 */

export type TableRefType = {
  reload: () => void;
};

import React from 'react';
import { DeepKeys, DeepValue } from '@tanstack/react-table';
import { cloneDeep, get, set } from 'lodash';
import { PaginatedData, PaginationParams } from '@/utils/queries/hooks';
import { StatePair } from '@/utils/state';
import { AutoFilterDataType } from '@/components/library/Filter/types';

/*
  Contexts
 */

export interface EditContext<T> {
  isEditing: boolean;
  isBusy: boolean;
  toggleEditing: (isEditing?: boolean) => void;
  state: StatePair<T>;
  onConfirm: (value?: T) => void;
}

export interface ItemContext<Item> {
  item: Item;
  edit: EditContext<Item>;
  external: unknown;
}

export interface CellContext<Value, Item> {
  value: Value;
  item: Item;
  external?: unknown;
}

export interface CellEditContext<Value, Item> extends CellContext<Value, Item> {
  edit: EditContext<Value | undefined>;
}

/*
  Actions
 */
export type SelectionActionProps<Item, Params extends object | unknown> = {
  selectedIds: string[];
  selectedItems: Record<string, Item>;
  params: Params;
  setParams: (cb: (oldState: AllParams<Params>) => AllParams<Params>) => void;
  onResetSelection: () => void;
  isDisabled: boolean;
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

export type PaginatedParams<Params> = Params & PaginationParams;
export type SortedParams<Params> = Params & SortingParams;
export type AllParams<Params> = Params & CommonParams;

/*
  Table data types
*/

export type TableDataSimpleItem<T> = T;

export type TableDataMultiRowsItem<T> = {
  spanBy: string[]; // id list
  rows: T[];
};

export type TableDataItem<T> = TableDataSimpleItem<T> | TableDataMultiRowsItem<T>;

export type TableData<T> = PaginatedData<TableDataItem<T>>;

export function isMultiRows<T>(value: TableDataItem<T>): value is TableDataMultiRowsItem<T> {
  const result: TableDataMultiRowsItem<T> = value as TableDataMultiRowsItem<T>;
  return 'spanBy' in result && 'rows' in result;
}

export function isSingleRow<T>(value: TableDataItem<T>): value is TableDataSimpleItem<T> {
  return !isMultiRows<T>(value);
}

/*
  Table item passed to columns with metadata about row
 */
export type TableRow<T> = {
  spanBy: string[]; // id list
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
export interface FullColumnDataType<Value, Item = unknown> {
  render?: (value: Value | undefined, context: CellContext<Value, Item>) => JSX.Element;
  renderEdit?: (context: CellEditContext<Value, Item>) => JSX.Element;
  stringify?: (value: Value | undefined, item: Item) => string; // can be used for export // todo: make it optional
  link?: (value: Value | undefined, item: Item) => string | undefined; // can be used for export
  defaultWrapMode?: 'WRAP' | 'OVERFLOW';
  autoFilterDataType?: AutoFilterDataType;
}

// Simplified variant of a data type which doesn't use parent item
export type ColumnDataType<Value, Item = unknown> = FullColumnDataType<Value, Item | null>;

export type FieldAccessor<Item> = DeepKeys<Item>;
export type ValueOf<Accessor> = Accessor extends FieldAccessor<infer Item>
  ? DeepValue<Item, Accessor>
  : never;

export interface BaseColumn {
  id?: string;
  title: string;
  tooltip?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  defaultWidth?: number;
  defaultSticky?: false | 'RIGHT' | 'LEFT';
  defaultEditState?: boolean;
  defaultVisibility?: boolean;
  enableResizing?: boolean;
  disableColumnShuffling?: boolean;
  headerTitle?: string; // In cases where there is empty title, we can use headerTitle to show title in csv
}

export interface GroupColumn<Item extends object> extends BaseColumn {
  children: TableColumn<Item>[];
}

export interface DisplayColumn<Item extends object> extends BaseColumn {
  render: (item: Item, context: ItemContext<Item>) => React.ReactNode;
}

export interface DataColumn extends BaseColumn {
  children?: never;
  sorting?: boolean | 'desc'; // false by default
  filtering?: boolean; // true by default
  pinFilterToLeft?: boolean; // false by default
  exporting?: boolean; // true by default
  hideInTable?: boolean;
}

export interface SimpleColumn<Item extends object, Accessor extends FieldAccessor<Item>>
  extends DataColumn {
  key: Accessor;
  type?: FullColumnDataType<NonNullable<DeepValue<Item, Accessor>>, Item>;
  showFilterByDefault?: boolean;
}

export interface DerivedColumn<Item extends object, Value = unknown> extends DataColumn {
  // value: (item: Item, context: ItemContext<Item>) => Value | undefined;
  value: (item: Item) => Value | undefined;
  type?: FullColumnDataType<Value, Item>;
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
    return String(column.id ?? column.key);
  }
  return column.id ?? column.title;
}

export function applyFieldAccessor<
  Item,
  Accessor extends FieldAccessor<Item> = FieldAccessor<unknown>,
>(item: Item, accessor: Accessor): DeepValue<Item, Accessor> {
  return get(item, accessor);
}
export function setByFieldAccessor<
  Item extends object,
  Accessor extends FieldAccessor<Item> = FieldAccessor<unknown>,
>(item: Item, accessor: Accessor, value: DeepValue<Item, Accessor> | undefined): Item {
  const result: Item = cloneDeep(item);
  set(result, accessor, value);
  return result;
}

/*
  Tools
 */
export type ToolRenderer = () => React.ReactNode;

/*
  Ref type
 */

export type TableRefType = {
  reload: () => void;
  isAllExpanded: () => boolean;
  toggleExpanded: (value?: boolean) => void;
  toggleSelected: (value?: boolean) => void;
  expandRow: (id: string | undefined) => void;
};

/* Selection Info */

export interface SelectionInfo {
  entityName: string;
  entityCount: number;
}

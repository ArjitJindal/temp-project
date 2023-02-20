import { SortOrder as AntdSortOrder } from 'antd/es/table/interface';
import { ProColumnType } from '@ant-design/pro-table/es/typing';
import React from 'react';
import { PaginatedData } from '@/utils/queries/hooks';
import { AllParams } from '@/components/ui/Table/index';
import { Option } from '@/components/library/Select';

/*
  Input table data types
 */
export type TableDataSimpleItem<T> = T;

export type TableDataMultiRowsItem<T> = {
  item: T;
  rows: T[];
};

export type TableDataItem<T> = TableDataSimpleItem<T> | TableDataMultiRowsItem<T>;

export function isMultiRows<T>(value: TableDataItem<T>): value is TableDataMultiRowsItem<T> {
  return 'item' in value && 'rows' in value;
}

export type TableData<T> = PaginatedData<TableDataItem<T>>;

/*
  Table item passed to columns with metadata about row
 */
export type TableRow<T> = T & {
  entityKey: string;
  rowsCount: number;
  isFirstRow: boolean;
  isLastRow: boolean;
};

// Other types
export type SortOrder = AntdSortOrder;

/*
  Returns a set of all possible paths for specified object, separated by dot

  Example:
  KeyPath<{ a: 42, b: { c: 666 }}> = 'a' | 'b' | 'b.c'
 */
export type KeyPath<T> = Values<{
  [K in keyof T]: K extends string ? K | `${K}.${string & GetValuePath<T[K]>}` : never;
}>;
type Values<T> = T extends { [k: string]: infer V } ? V : never;
type GetValuePath<T> = T extends number
  ? never
  : T extends string
  ? never
  : T extends boolean
  ? never
  : T extends object
  ? KeyPath<T>
  : T extends any[]
  ? never
  : never;

export type GroupColumn<T extends object | unknown> = ProColumnType<TableRow<T>> & {
  children: TableColumn<T>[];
};

type ExtraFieldProps = {
  displayMode?: string;
  icon?: React.ReactNode;
};

export type SimpleColumn<T extends object | unknown, Value = unknown> =
  | (ProColumnType<TableRow<T>> & {
      children?: never;
      fieldProps?: ProColumnType['fieldProps'] & ExtraFieldProps;
      exportData?: KeyPath<T> | ((entity: T) => Value) | false;
    })
  | (ProColumnType<TableRow<T>> & {
      children?: never;
      hideInTable: true;
    });

export type TableColumn<T extends object | unknown> = GroupColumn<T> | SimpleColumn<T>;

export function isGroupColumn<T extends object | unknown>(
  column: TableColumn<T>,
): column is GroupColumn<T> {
  return column != null && 'children' in column;
}

export function isSimpleColumn<T extends object | unknown, V = unknown>(
  column: TableColumn<T>,
): column is SimpleColumn<T, V> {
  return !isGroupColumn(column);
}

/*
  Actions
 */
export type ActionRendererProps<Params extends object | unknown> = {
  params: Params;
  setParams: (cb: (oldState: AllParams<Params>) => AllParams<Params>) => void;
};
export type ActionRenderer<Params extends object | unknown> = (
  props: ActionRendererProps<Params>,
) => React.ReactNode;

/*
  Filters
 */
export interface BaseFilter {
  key: string;
  title: React.ReactNode;
  icon?: React.ReactNode;
  showFilterByDefault?: boolean;
}

export type ExtraFilterRenderer<Params extends object | unknown> = ActionRenderer<Params>;

export interface ExtraFilter<Params extends object | unknown> extends BaseFilter {
  kind?: 'EXTRA';
  renderer: ExtraFilterRenderer<Params>;
}

export function isExtraFilter<Params extends object | unknown>(
  filter: Filter<Params>,
): filter is ExtraFilter<Params> {
  return filter.kind == null || filter.kind === 'EXTRA';
}

export type AutoFilterDataType =
  | { kind: 'string' }
  | { kind: 'number' }
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

import { SortOrder as AntdSortOrder } from 'antd/es/table/interface';
import { ProColumnType } from '@ant-design/pro-table/es/typing';
import { PaginatedData } from '@/utils/queries/hooks';

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

export type GroupColumn<T extends object> = ProColumnType<TableRow<T>> & {
  children: TableColumn<T>[];
};

export type SimpleColumn<T extends object, Value = unknown> =
  | (ProColumnType<TableRow<T>> & {
      children?: never;
      exportData?: KeyPath<T> | ((entity: T) => Value) | false;
    })
  | (ProColumnType<TableRow<T>> & {
      children?: never;
      hideInTable: true;
    });

export type TableColumn<T extends object> = GroupColumn<T> | SimpleColumn<T>;

export function isGroupColumn<T extends object>(column: TableColumn<T>): column is GroupColumn<T> {
  return 'children' in column;
}

export function isSimpleColumn<T extends object, V = unknown>(
  column: TableColumn<T>,
): column is SimpleColumn<T, V> {
  return !isGroupColumn(column);
}

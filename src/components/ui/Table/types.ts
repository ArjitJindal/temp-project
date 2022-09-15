import { ProColumns } from '@ant-design/pro-table';
import { SortOrder as AntdSortOrder } from 'antd/es/table/interface';

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

export type TableData<T extends object> = {
  success?: boolean;
  total?: number;
  items: Array<TableDataItem<T>>;
};

/*
  Table item passed to columns with metadata about row
 */
export type TableRow<T extends object> = T & {
  entityKey: string;
  rowsCount: number;
  isFirstRow: boolean;
  isLastRow: boolean;
};

// Other types
export type SortOrder = AntdSortOrder;

export type TableColumn<T extends object> = ProColumns<TableRow<T>>;

import '@tanstack/react-table';
import { TableColumn, FieldAccessor } from '@/components/library/Table/types';
declare module '@tanstack/table-core' {
  interface ColumnMeta<Item> {
    rowKey?: FieldAccessor<Item>;
    column: TableColumn<Item>;
    wrapMode: string;
    tooltip?: string;
    subtitle?: string;
  }
  interface TableMeta<Item> {
    onEdit?: (rowKey: string, newValue: Item) => void;
  }
}

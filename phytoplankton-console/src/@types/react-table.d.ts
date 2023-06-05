import '@tanstack/react-table';

declare module '@tanstack/table-core' {
  interface ColumnMeta {
    wrapMode: string;
    tooltip?: string;
    subtitle?: string;
  }
  interface TableMeta<Item> {
    onEdit?: (rowKey: string, newValue: Item) => void;
  }
}

import '@tanstack/react-table';

declare module '@tanstack/table-core' {
  interface ColumnMeta {
    key?: string;
    wrapMode: string;
    tooltip?: string;
  }
}

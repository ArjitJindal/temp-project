import { TableItem } from './types';
import { QueryResult } from '@/utils/queries/types';
import { TableData, TableDataItem } from '@/components/ui/Table/types';
import { map } from '@/utils/asyncResource';
import { AuditLogListResponse } from '@/apis';

export function useTableData(
  queryResult: QueryResult<AuditLogListResponse>,
): QueryResult<TableData<TableItem>> {
  const result: QueryResult<TableData<TableItem>> = {
    data: map(queryResult.data, (response) => {
      const items: TableDataItem<TableItem>[] = response.data.map(
        (item, index): TableDataItem<TableItem> => {
          const dataItem: TableItem = {
            index,
            ...item,
          };
          return dataItem;
        },
      );
      return {
        items,
        success: true,
        total: response.total,
      };
    }),
    refetch: queryResult.refetch,
  };
  return result;
}

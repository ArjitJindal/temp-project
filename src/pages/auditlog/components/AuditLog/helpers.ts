import { TableItem } from './types';
import { map, QueryResult } from '@/utils/queries/types';
import { TableDataItem } from '@/components/ui/Table/types';
import { AuditLog } from '@/apis';
import { PaginatedData } from '@/utils/queries/hooks';

export function useTableData(
  queryResult: QueryResult<PaginatedData<AuditLog>>,
): QueryResult<PaginatedData<TableDataItem<TableItem>>> {
  return map(
    queryResult,
    (response): PaginatedData<TableDataItem<TableItem>> => ({
      total: response.total,
      items: response.items.map(
        (item, index): TableDataItem<TableItem> => ({
          index,
          ...item,
        }),
      ),
    }),
  );
}

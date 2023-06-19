import { TableItem } from './types';
import { map, QueryResult } from '@/utils/queries/types';
import { AuditLog } from '@/apis';
import { PaginatedData } from '@/utils/queries/hooks';

export function useTableData(
  queryResult: QueryResult<PaginatedData<AuditLog>>,
): QueryResult<PaginatedData<TableItem>> {
  return map(
    queryResult,
    (response): PaginatedData<TableItem> => ({
      total: response.total,
      items: response.items.map(
        (item, index): TableItem => ({
          index,
          ...item,
        }),
      ),
    }),
  );
}

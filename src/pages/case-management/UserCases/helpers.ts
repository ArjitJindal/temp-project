import { TableItem } from './types';
import { QueryResult } from '@/utils/queries/types';
import { TableData, TableDataItem } from '@/components/ui/Table/types';
import { map } from '@/utils/asyncResource';
import { CasesListResponse } from '@/apis';

export function useTableData(
  queryResult: QueryResult<CasesListResponse>,
): QueryResult<TableData<TableItem>> {
  const result: QueryResult<TableData<TableItem>> = {
    data: map(queryResult.data, (response) => {
      const items: TableDataItem<TableItem>[] = response.data.map(
        (item, index): TableDataItem<TableItem> => {
          const caseUser = item.caseUsers ?? {};
          const user = caseUser.origin ?? caseUser.destination ?? undefined;
          const dataItem: TableItem = {
            index,
            userId: user?.userId ?? null,
            user: user != null && 'type' in user ? user : null,
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

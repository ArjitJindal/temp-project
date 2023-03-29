import { TableItem } from './types';
import { map, QueryResult } from '@/utils/queries/types';
import { TableData, TableDataItem } from '@/components/ui/Table/types';
import { CaseResponse } from '@/apis';
import { PaginatedData } from '@/utils/queries/hooks';

export function useTableData(
  queryResult: QueryResult<PaginatedData<CaseResponse>>,
): QueryResult<TableData<TableItem>> {
  return map(queryResult, (response) => {
    const items: TableDataItem<TableItem>[] = response.items.map(
      (item, index): TableDataItem<TableItem> => {
        const caseUser = item.caseUsers ?? {};
        const user = caseUser.origin ?? caseUser.destination ?? undefined;
        const dataItem: TableItem = {
          index,
          userId: user?.userId ?? null,
          user: user != null && 'type' in user ? user : null,
          lastStatusChangeReasons: {
            reasons: item.lastStatusChange?.reason ?? [],
            otherReason: item.lastStatusChange?.otherReason ?? null,
          },
          ...item,
        };
        return dataItem;
      },
    );
    return {
      items,
      total: response.total,
    };
  });
}

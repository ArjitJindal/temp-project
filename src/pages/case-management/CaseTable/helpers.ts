import { TableItem } from './types';
import { map, QueryResult } from '@/utils/queries/types';
import { TableData, TableDataItem } from '@/components/ui/Table/types';
import { Case } from '@/apis';
import { PaginatedData } from '@/utils/queries/hooks';

export function useTableData(
  queryResult: QueryResult<PaginatedData<Case>>,
): QueryResult<TableData<TableItem>> {
  return map(queryResult, (response) => {
    const items: TableDataItem<TableItem>[] = response.items.map(
      (item, index): TableDataItem<TableItem> => {
        const caseUser = item.caseUsers ?? {};
        const user = caseUser.origin ?? caseUser.destination ?? undefined;
        const lastStatusChange = item.statusChanges?.[item.statusChanges?.length - 1] ?? null;
        const dataItem: TableItem = {
          index,
          userId: user?.userId ?? null,
          user: user != null && 'type' in user ? user : null,
          lastStatusChange,
          lastStatusChangeReasons: lastStatusChange
            ? {
                reasons: lastStatusChange.reason ?? [],
                otherReason: lastStatusChange.otherReason ?? null,
              }
            : null,
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

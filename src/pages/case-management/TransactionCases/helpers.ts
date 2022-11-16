import { map, QueryResult } from '@/utils/queries/types';
import { TableData, TableDataItem } from '@/components/ui/Table/types';
import { Case, CaseCreationType } from '@/apis';
import { PaginatedData } from '@/utils/queries/hooks';
import { TableItem } from '@/pages/case-management/TransactionCases/types';
import { filterRulesHitByCaseCreationType } from '@/utils/rules';

export function useTableData(
  queryResult: QueryResult<PaginatedData<Case>>,
  caseType: CaseCreationType,
): QueryResult<TableData<TableItem>> {
  return map(queryResult, (response) => {
    const items: TableDataItem<TableItem>[] = response.items.map(
      (item, index): TableDataItem<TableItem> => {
        const caseTransactions = item.caseTransactions ?? [];
        const dataItem: TableItem = {
          index,
          rowKey: item.caseId ?? `${index}`,
          transaction: null,
          transactionFirstRow: true,
          transactionsRowsCount: 1,
          lastStatusChange: item.statusChanges?.[item.statusChanges?.length - 1] ?? null,
          ...item,
        };
        if (caseTransactions.length === 0) {
          return dataItem;
        }
        return {
          item: dataItem,
          rows: caseTransactions.flatMap((transaction) => {
            if (transaction.hitRules.length === 0) {
              return [
                {
                  ...dataItem,
                  rowKey: `${item.caseId}#${transaction.transactionId}`,
                  transaction,
                },
              ];
            }
            const hitRules = filterRulesHitByCaseCreationType(transaction.hitRules, caseType);
            return hitRules.map((rule, i): TableItem => {
              return {
                ...dataItem,
                rowKey: `${item.caseId}#${transaction.transactionId}#${i}`,
                transaction: transaction,
                ruleName: rule.ruleName,
                ruleDescription: rule.ruleDescription,
                ruleAction: rule.ruleAction,
                transactionsRowsCount: hitRules.length,
                transactionFirstRow: i === 0,
              };
            });
          }),
        };
      },
    );
    return {
      items,
      success: true,
      total: response.total,
    };
  });
}

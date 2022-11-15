import { QueryResult } from '@/utils/queries/types';
import { TableData, TableDataItem } from '@/components/ui/Table/types';
import { map } from '@/utils/asyncResource';
import { CaseManagementItem } from '@/pages/case-management/TransactionCases';
import { CaseCreationType, CasesListResponse } from '@/apis';
import { filterRulesHitByCaseCreationType } from '@/utils/rules';

export function useTableData(
  queryResult: QueryResult<CasesListResponse>,
  caseType: CaseCreationType,
): QueryResult<TableData<CaseManagementItem>> {
  const result: QueryResult<TableData<CaseManagementItem>> = {
    data: map(queryResult.data, (response) => {
      const items: TableDataItem<CaseManagementItem>[] = response.data.map(
        (item, index): TableDataItem<CaseManagementItem> => {
          const caseTransactions = item.caseTransactions ?? [];
          const dataItem: CaseManagementItem = {
            index,
            rowKey: item.caseId ?? `${index}`,
            transaction: null,
            transactionFirstRow: true,
            transactionsRowsCount: 1,
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
              return hitRules.map((rule, i): CaseManagementItem => {
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
    }),
    refetch: queryResult.refetch,
  };
  return result;
}

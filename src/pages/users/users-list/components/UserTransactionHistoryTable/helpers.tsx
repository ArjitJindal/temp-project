import { TransactionCaseManagement } from '@/apis';
import { DataItem } from '@/pages/users/users-list/components/UserTransactionHistoryTable/index';

export function prepareTableData(
  userId: string | undefined,
  transactions: Array<TransactionCaseManagement>,
): DataItem[] {
  const data: DataItem[] = transactions.reduce((acc, item, index): DataItem[] => {
    const lastRowKey = `${item.transactionId}_last_row`;
    const dataItem: DataItem = {
      index,
      rowKey: lastRowKey,
      lastRowKey: lastRowKey,
      transactionId: item.transactionId,
      timestamp: item.timestamp,
      originAmountDetails: item.originAmountDetails,
      destinationAmountDetails: item.destinationAmountDetails,
      direction: item.originUserId === userId ? 'Outgoing' : 'Incoming',
      status: item.status,
      events: item.events ?? [],
      isFirstRow: true,
      isLastRow: true,
      ruleName: null,
      ruleDescription: null,
      rowSpan: 1,
    };
    if (item.hitRules.length === 0) {
      return [...acc, dataItem];
    }
    return [
      ...acc,
      ...item.hitRules.map((rule, i): DataItem => {
        const isLastRow = i === item.hitRules.length - 1;
        return {
          ...dataItem,
          rowSpan: i === 0 ? item.hitRules.length : 0,
          isFirstRow: i === 0,
          isLastRow: isLastRow,
          rowKey: isLastRow ? lastRowKey : `${item.transactionId}#${i}`,
          ruleName: rule.ruleName,
          ruleDescription: rule.ruleDescription,
        };
      }),
    ];
  }, [] as DataItem[]);
  return data;
}

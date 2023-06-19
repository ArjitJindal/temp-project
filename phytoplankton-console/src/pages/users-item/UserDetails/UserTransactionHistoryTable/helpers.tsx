import { InternalTransaction } from '@/apis';
import { DataItem } from '@/pages/users-item/UserDetails/UserTransactionHistoryTable';
import { TableDataItem } from '@/components/library/Table/types';

export function prepareTableData(
  userId: string | undefined,
  transactions: Array<InternalTransaction>,
): TableDataItem<DataItem>[] {
  return transactions.map((item, index): TableDataItem<DataItem> => {
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
      ruleName: null,
      ruleDescription: null,
      arsRiskLevel: item.arsScore?.riskLevel,
      arsScore: item.arsScore?.arsScore,
    };
    if (item.hitRules.length === 0) {
      return dataItem;
    }
    return {
      spanBy: [
        'transactionId',
        'arsScore',
        'arsScore.arsScore',
        'arsRiskLevel',
        'lastTransactionState',
        'timestamp',
        'status',
        'direction',
        'originAmount',
        'originCountry',
        'destinationAmount',
        'destinationCountry',
      ],
      rows: item.hitRules.map((rule, i): DataItem => {
        const isLastRow = i === item.hitRules.length - 1;
        return {
          ...dataItem,
          rowKey: isLastRow ? lastRowKey : `${item.transactionId}#${i}`,
          ruleName: rule.ruleName,
          ruleDescription: rule.ruleDescription,
        };
      }),
    };
  });
}

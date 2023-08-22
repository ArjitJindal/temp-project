import { InternalTransaction } from '@/apis';
import { DataItem } from '@/pages/users-item/UserDetails/UserTransactionHistoryTable';
import { TableDataItem } from '@/components/library/Table/types';

export function prepareTableData(
  userId: string | undefined,
  transactions: Array<InternalTransaction>,
): TableDataItem<DataItem>[] {
  return transactions.map((item, index): TableDataItem<DataItem> => {
    const dataItem: DataItem = {
      index,
      rowKey: item.transactionId,
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
        'destinationPaymentMethodId',
        'originPaymentMethodId',
      ],
      rows: item.hitRules.map((rule): DataItem => {
        return {
          ...dataItem,
          rowKey: item.transactionId,
          ruleName: rule.ruleName,
          ruleDescription: rule.ruleDescription,
        };
      }),
    };
  });
}

import { v4 as uuid } from 'uuid';
import { getRiskLevelFromScore } from '@flagright/lib/utils';
import { CurrencyCode, RiskClassificationScore, TransactionTableItem } from '@/apis';
import { DataItem } from '@/pages/users-item/UserDetails/UserTransactionHistoryTable';
import { TableDataItem } from '@/components/library/Table/types';

export function prepareTableData(
  userId: string | undefined,
  transactions: Array<TransactionTableItem>,
  riskClassificationValues: RiskClassificationScore[],
): TableDataItem<DataItem>[] {
  return transactions.map((item, index): TableDataItem<DataItem> => {
    const originPayment = item.originPayment;
    const destinationPayment = item.destinationPayment;

    const dataItem: DataItem = {
      index,
      rowKey: item.transactionId,
      transactionId: item.transactionId,
      timestamp: item.timestamp,
      originAmountDetails: {
        transactionAmount: originPayment?.amount as number,
        transactionCurrency: originPayment?.currency as CurrencyCode,
        country: originPayment?.country,
      },
      destinationAmountDetails: {
        transactionAmount: destinationPayment?.amount as number,
        transactionCurrency: destinationPayment?.currency as CurrencyCode,
        country: destinationPayment?.country,
      },
      direction: item.originUser?.id === userId ? 'Outgoing' : 'Incoming',
      status: item.status,
      ruleName: null,
      ruleDescription: null,
      arsRiskLevel: getRiskLevelFromScore(riskClassificationValues, item.ars?.score ?? null),
      arsScore: item.ars?.score,
      transactionState: item.transactionState,
      originPaymentDetails: item.originPayment?.paymentDetails,
      destinationPaymentDetails: item.destinationPayment?.paymentDetails,
      alertIds: item.alertIds,
    };

    if (item.hitRules?.length === 0) {
      return dataItem;
    }

    return {
      spanBy: [
        'transactionId',
        'arsScore',
        'arsRiskLevel',
        'transactionState',
        'timestamp',
        'status',
        'direction',
        'originAmount',
        'originCountry',
        'destinationAmount',
        'destinationCountry',
        'destinationPaymentMethodId',
        'originPaymentMethodId',
        'destinationPaymentMethodId',
        'originPaymentDetails',
        'destinationPaymentDetails',
      ],
      rows: (item.hitRules ?? []).map((rule, i): DataItem => {
        const isFirstRow = i == 0;
        return {
          ...dataItem,
          rowKey: isFirstRow ? item.transactionId : `${item.transactionId}-${uuid()}`,
          ruleName: rule.ruleName ?? null,
          ruleDescription: rule.ruleDescription ?? null,
        };
      }),
    };
  });
}

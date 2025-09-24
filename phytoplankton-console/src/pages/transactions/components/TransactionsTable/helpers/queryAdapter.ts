import { TransactionsTableParams } from '..';
import { PaymentMethod, RuleAction, TransactionState } from '@/apis';
import { defaultQueryAdapter } from '@/components/library/Table/queryAdapter';
import { dayjs } from '@/utils/dayjs';
import { Adapter } from '@/utils/routing';

export const queryAdapter: Adapter<TransactionsTableParams> = {
  serializer: (params: TransactionsTableParams) => {
    return {
      ...defaultQueryAdapter.serializer(params),
      current: params.current,
      timestamp: params.timestamp?.map((x) => dayjs(x).valueOf()).join(','),
      transactionId: params.transactionId,
      transactionTypes: params.transactionTypes?.join(',') ?? '',
      transactionState: params.transactionState?.join(',') ?? '',
      originCurrenciesFilter: params.originCurrenciesFilter?.join(',') ?? '',
      destinationCurrenciesFilter: params.destinationCurrenciesFilter?.join(',') ?? '',
      userId: params.userId,
      parentUserId: params.parentUserId,
      tagKey: params.tagKey,
      status: params.status,
      tagValue: params.tagValue,
      originMethodFilter: params.originMethodFilter,
      destinationMethodFilter: params.destinationMethodFilter,
      originPaymentMethodId: params.originPaymentMethodId,
      destinationPaymentMethodId: params.destinationPaymentMethodId,
      ruleInstancesHitFilter: params.ruleInstancesHitFilter?.join(',') ?? '',
      productType: params.productType?.join(',') ?? '',
      'originAmountDetails.country': params['originAmountDetails.country']?.join(',') ?? '',
      'destinationAmountDetails.country':
        params['destinationAmountDetails.country']?.join(',') ?? '',
      includePaymentDetails: 'true',
      filterOriginPaymentMethodId: params['originPayment.paymentMethodId'],
      filterDestinationPaymentMethodId: params['destinationPayment.paymentMethodId'],
      filterPaymentDetailName: params.filterPaymentDetailName,
      reference: params.reference,
    };
  },
  deserializer: (raw): TransactionsTableParams => {
    return {
      ...defaultQueryAdapter.deserializer(raw),
      current: raw.current,
      timestamp: raw.timestamp
        ? raw.timestamp.split(',').map((x) => dayjs(parseInt(x)).format())
        : undefined,
      transactionId: raw.transactionId,
      transactionTypes: raw.transactionTypes?.split(','),
      transactionState: raw.transactionState
        ? (raw.transactionState.split(',') as TransactionState[])
        : undefined,
      originCurrenciesFilter: raw.originCurrenciesFilter
        ? raw.originCurrenciesFilter.split(',')
        : undefined,
      destinationCurrenciesFilter: raw.destinationCurrenciesFilter
        ? raw.destinationCurrenciesFilter.split(',')
        : undefined,
      userId: raw.userId,
      parentUserId: raw.parentUserId,
      tagKey: raw.tagKey,
      tagValue: raw.tagValue,
      status: raw.status as RuleAction & 'all',
      originMethodFilter: raw.originMethodFilter as PaymentMethod,
      destinationMethodFilter: raw.destinationMethodFilter as PaymentMethod,
      'originPayment.paymentMethodId': raw.filterOriginPaymentMethodId,
      'destinationPayment.paymentMethodId': raw.filterDestinationPaymentMethodId,
      ruleInstancesHitFilter: raw.ruleInstancesHitFilter?.split(','),
      productType: raw.productType?.split(','),
      'originAmountDetails.country': raw['originAmountDetails.country']?.split(','),
      'destinationAmountDetails.country': raw['destinationAmountDetails.country']?.split(','),
      showDetailedView: raw.includePaymentDetails === 'true',
      filterPaymentDetailName: raw.filterPaymentDetailName,
      reference: raw.reference,
    };
  },
};

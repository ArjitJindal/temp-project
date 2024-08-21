import { TransactionsTableParams } from '..';
import { Mode } from '../../UserSearchPopup/types';
import { PaymentMethod, TransactionState } from '@/apis';
import { defaultQueryAdapter } from '@/components/library/Table/queryAdapter';
import { dayjs } from '@/utils/dayjs';
import { Adapter } from '@/utils/routing';

const DEFAULT_TIMESTAMP = [dayjs().subtract(1, 'month').startOf('day'), dayjs().endOf('day')];

export const queryAdapter: Adapter<TransactionsTableParams> = {
  serializer: (params: TransactionsTableParams) => {
    return {
      ...defaultQueryAdapter.serializer(params),
      current: params.current,
      timestamp:
        params.timestamp?.map((x) => dayjs(x).valueOf()).join(',') ??
        DEFAULT_TIMESTAMP.map((x) => x.valueOf()).join(','),
      transactionId: params.transactionId,
      type: params.type,
      transactionState: params.transactionState?.join(',') ?? '',
      originCurrenciesFilter: params.originCurrenciesFilter?.join(',') ?? '',
      destinationCurrenciesFilter: params.destinationCurrenciesFilter?.join(',') ?? '',
      userId: params.userId,
      userFilterMode: params.userFilterMode,
      tagKey: params.tagKey,
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
    };
  },
  deserializer: (raw): TransactionsTableParams => {
    return {
      ...defaultQueryAdapter.deserializer(raw),
      current: raw.current,
      timestamp: raw.timestamp
        ? raw.timestamp.split(',').map((x) => dayjs(parseInt(x)).format())
        : DEFAULT_TIMESTAMP.map((x) => x.format()),
      transactionId: raw.transactionId,
      type: raw.type,
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
      userFilterMode: raw.userFilterMode as Mode,
      tagKey: raw.tagKey,
      tagValue: raw.tagValue,
      originMethodFilter: raw.originMethodFilter as PaymentMethod,
      destinationMethodFilter: raw.destinationMethodFilter as PaymentMethod,
      originPaymentMethodId: raw.originPaymentMethodId,
      destinationPaymentMethodId: raw.destinationPaymentMethodId,
      ruleInstancesHitFilter: raw.ruleInstancesHitFilter?.split(','),
      productType: raw.productType?.split(','),
      'originAmountDetails.country': raw['originAmountDetails.country']?.split(','),
      'destinationAmountDetails.country': raw['destinationAmountDetails.country']?.split(','),
    };
  },
};

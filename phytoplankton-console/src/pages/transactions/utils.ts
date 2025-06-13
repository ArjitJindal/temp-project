import { useApi } from '@/api';
import { TransactionTableItem } from '@/apis';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { TRANSACTIONS_LIST } from '@/utils/queries/keys';
import { useCursorQuery, usePaginatedQuery } from '@/utils/queries/hooks';
import {
  TransactionsTableParams,
  transactionParamsToRequest,
} from '@/pages/transactions/components/TransactionsTable';

type UseTransactionsQueryParams = {
  isReadyToFetch?: boolean;
  debounce?: number;
};

export function useTransactionsQuery(
  params: TransactionsTableParams,
  { isReadyToFetch, debounce }: UseTransactionsQueryParams = {},
) {
  const api = useApi({ ...(debounce ? { debounce } : undefined) });
  const isClickhouseEnabled = useFeatureEnabled('CLICKHOUSE_ENABLED');

  const queryResult = useCursorQuery<TransactionTableItem>(
    TRANSACTIONS_LIST(params),
    async ({ from, view }) => {
      if (isClickhouseEnabled) {
        return {
          count: 0,
          hasNext: false,
          items: [],
          hasPrev: false,
          last: '',
          next: '',
          prev: '',
          limit: 0,
        };
      }
      return await api.getTransactionsList({
        start: from || params.from,
        ...transactionParamsToRequest({ ...params, view }, { ignoreDefaultTimestamps: true }),
      });
    },
    { enabled: isReadyToFetch },
  );

  const queryResultOffset = usePaginatedQuery<TransactionTableItem>(
    TRANSACTIONS_LIST({ ...params, offset: true }),
    async (paginationParams) => {
      if (!isClickhouseEnabled) {
        return {
          items: [],
          total: 0,
        };
      }
      const data = await api.getTransactionsV2List({
        ...transactionParamsToRequest(
          { ...params, view: paginationParams.view },
          { ignoreDefaultTimestamps: true },
        ),
        ...paginationParams,
      });
      return {
        items: data.items,
        total: parseInt(`${data.count}`), // parse because clickhouse returns string
      };
    },
    { enabled: isReadyToFetch },
  );

  return {
    queryResult: isClickhouseEnabled ? queryResultOffset : queryResult,
    cacheKey: isClickhouseEnabled
      ? TRANSACTIONS_LIST({ ...params, offset: true })
      : TRANSACTIONS_LIST(params),
  };
}

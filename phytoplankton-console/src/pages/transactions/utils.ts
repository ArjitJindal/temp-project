import { QueryKey } from '@tanstack/react-query';
import { useApi } from '@/api';
import { TransactionTableItem } from '@/apis';
import { TRANSACTIONS_LIST } from '@/utils/queries/keys';
import { PaginatedData, usePaginatedQuery } from '@/utils/queries/hooks';
import {
  TransactionsTableParams,
  transactionParamsToRequest,
} from '@/pages/transactions/components/TransactionsTable';
import { QueryResult } from '@/utils/queries/types';

type UseTransactionsQueryParams<T extends object = TransactionTableItem> = {
  isReadyToFetch?: boolean;
  debounce?: number;
  mapper?: (data: TransactionTableItem[]) => T[];
};

export function useTransactionsQuery<T extends object = TransactionTableItem>(
  params: TransactionsTableParams,
  { isReadyToFetch, debounce, mapper }: UseTransactionsQueryParams<T> = {},
): {
  queryResult: QueryResult<PaginatedData<T>>;
  cacheKey: QueryKey;
} {
  const api = useApi({ ...(debounce ? { debounce } : undefined) });

  const queryResultOffset = usePaginatedQuery<T>(
    TRANSACTIONS_LIST({ ...params, ...(mapper ? { mapper: mapper.toString() } : {}) }),
    async (paginationParams) => {
      const data = await api.getTransactionsList({
        ...transactionParamsToRequest(
          { ...params, view: paginationParams.view },
          { ignoreDefaultTimestamps: true },
        ),
        ...paginationParams,
      });

      return {
        items: (mapper ? mapper(data.items) : data.items) as T[],
        total: parseInt(`${data.count}`), // parse because clickhouse returns string
      };
    },
    { enabled: isReadyToFetch },
  );

  return {
    queryResult: queryResultOffset,
    cacheKey: TRANSACTIONS_LIST(params),
  };
}

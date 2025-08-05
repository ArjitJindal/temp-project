import { useMemo } from 'react';
import { QueryKey } from '@tanstack/react-query';
import { useApi } from '@/api';
import { TransactionTableItem } from '@/apis';
import { TRANSACTIONS_LIST, TRANSACTIONS_COUNT } from '@/utils/queries/keys';
import { PaginatedData, usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
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
  countQueryResult: QueryResult<{ total: number }>;
  cacheKey: QueryKey;
} {
  const api = useApi({ ...(debounce ? { debounce } : undefined) });

  const queryResultOffset = usePaginatedQuery<T>(
    TRANSACTIONS_LIST({ ...params, ...(mapper ? { mapper: mapper.toString() } : {}) }),
    async (paginationParams) => {
      const data = await api.getTransactionsList({
        ...transactionParamsToRequest(
          { ...params, view: paginationParams.view, responseType: 'data' },
          { ignoreDefaultTimestamps: true },
        ),
        ...paginationParams,
      });

      return {
        items: (mapper ? mapper(data.items) : data.items) as T[],
        total: data.count ? parseInt(`${data.count}`) : 0,
      };
    },
    { enabled: isReadyToFetch },
  );
  const countParams = useMemo(() => {
    return {
      ...params,
      page: 0,
      pageSize: 0,
    };
  }, [params]);
  const countQueryResult = useQuery<{ total: number }>(
    TRANSACTIONS_COUNT(countParams),
    async () => {
      const countData = await api.getTransactionsList({
        ...transactionParamsToRequest(
          { ...countParams, responseType: 'count' },
          { ignoreDefaultTimestamps: true },
        ),
      });

      return {
        total: parseInt(`${countData.count}`),
      };
    },
    {
      enabled: isReadyToFetch,
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
    },
  );

  return {
    queryResult: queryResultOffset,
    countQueryResult,
    cacheKey: TRANSACTIONS_LIST(params),
  };
}

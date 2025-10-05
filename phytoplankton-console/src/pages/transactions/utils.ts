import { useMemo } from 'react';
import { QueryKey } from '@tanstack/react-query';
import { TransactionTableItem } from '@/apis';
import { TRANSACTIONS_LIST } from '@/utils/queries/keys';
import { PaginatedData } from '@/utils/queries/hooks';
import {
  TransactionsTableParams,
  transactionParamsToRequest,
} from '@/pages/transactions/components/TransactionsTable';
import { QueryResult } from '@/utils/queries/types';
import { useTransactionsCount, useTransactionsListPaginated } from '@/hooks/api/transactions';

type UseTransactionsQueryParams<T extends object = TransactionTableItem> = {
  isReadyToFetch?: boolean;
  debounce?: number;
  mapper?: (data: TransactionTableItem[]) => T[];
};

export function useTransactionsQuery<T extends object = TransactionTableItem>(
  params: TransactionsTableParams,
  { mapper }: UseTransactionsQueryParams<T> = {},
): {
  queryResult: QueryResult<PaginatedData<T>>;
  countQueryResult: QueryResult<{ total: number }>;
  cacheKey: QueryKey;
} {
  const queryResultOffset = useTransactionsListPaginated(
    transactionParamsToRequest(
      { ...params, responseType: 'data' },
      { ignoreDefaultTimestamps: true },
    ),
    mapper as any,
  ) as QueryResult<PaginatedData<T>>;
  const countParams = useMemo(() => {
    return {
      ...params,
      page: 0,
      pageSize: 0,
    };
  }, [params]);
  const countQueryResult = useTransactionsCount(
    transactionParamsToRequest(
      { ...countParams, responseType: 'count' },
      { ignoreDefaultTimestamps: true },
    ),
  ) as QueryResult<{ total: number }>;

  return {
    queryResult: queryResultOffset,
    countQueryResult,
    cacheKey: TRANSACTIONS_LIST(params),
  };
}

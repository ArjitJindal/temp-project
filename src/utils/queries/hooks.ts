import { QueryFunction, QueryKey } from '@tanstack/query-core';
import { useQuery as useQueryRQ } from '@tanstack/react-query';
import { UseQueryOptions } from '@tanstack/react-query/src/types';
import { getErrorMessage, neverThrow } from '@/utils/lang';
import { failed, loading, success } from '@/utils/asyncResource';
import { QueryResult } from '@/utils/queries/types';

export function useQuery<
  TQueryFnData = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  queryKey: TQueryKey,
  queryFn: QueryFunction<TQueryFnData, TQueryKey>,
  options?: Omit<
    UseQueryOptions<TQueryFnData, string, TData, TQueryKey>,
    'queryKey' | 'queryFn' | 'initialData'
  > & { initialData?: () => undefined },
): QueryResult<TData> {
  const results = useQueryRQ<TQueryFnData, string, TData, TQueryKey>(queryKey, queryFn, options);
  if (results.isLoading) {
    return {
      data: loading<TData>(results.data ?? null),
      refetch: results.refetch,
    };
  }
  if (results.isFetching) {
    return {
      data: loading<TData>(results.data),
      refetch: results.refetch,
    };
  }
  if (results.isSuccess) {
    return {
      data: success<TData>(results.data),
      refetch: results.refetch,
    };
  }
  if (results.isError) {
    return {
      data: failed<TData>(getErrorMessage(results.error)),
      refetch: results.refetch,
    };
  }
  throw neverThrow(results, `Unhandled query result state. ${JSON.stringify(results)}`);
}

export type PaginatedData<T> = {
  success?: boolean;
  total?: number;
  items: Array<T>;
};

export type PaginationParams = {
  pageSize: number;
  page: number;
};

export type PaginatedQueryFunction<T = unknown> = (
  paginationParams: Partial<PaginationParams>,
) => Promise<PaginatedData<T>>;

export function usePaginatedQuery<TData = unknown, TQueryKey extends QueryKey = QueryKey>(
  queryKey: TQueryKey,
  queryFn: PaginatedQueryFunction<TData>,
  options?: Omit<
    UseQueryOptions<PaginatedData<TData>, string, PaginatedData<TData>, TQueryKey>,
    'queryKey' | 'queryFn' | 'initialData'
  > & { initialData?: () => undefined },
): QueryResult<PaginatedData<TData>> {
  const result: QueryResult<PaginatedData<TData>> = useQuery<
    PaginatedData<TData>,
    PaginatedData<TData>,
    TQueryKey
  >(queryKey, () => queryFn({}), options);
  return {
    ...result,
    paginate: queryFn,
  };
}

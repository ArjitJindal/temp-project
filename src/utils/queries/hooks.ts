import { QueryFunction, QueryKey } from '@tanstack/query-core';
import { useQueries as useQueriesRQ, useQuery as useQueryRQ } from '@tanstack/react-query';
import {
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from '@tanstack/react-query/src/types';
import { QueriesOptions } from '@tanstack/react-query/build/types/packages/react-query/src/useQueries';
import { getErrorMessage, neverThrow } from '@/utils/lang';
import { AsyncResource, failed, loading, success } from '@/utils/asyncResource';
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
  return convertQueryResult(results);
}

export function useQueries<T>({
  queries,
  context,
}: {
  queries: readonly [...QueriesOptions<T[]>];
  context?: UseQueryOptions['context'];
}): QueryResult<T>[] {
  const results = useQueriesRQ({ queries, context });
  return results.map((x: any) => convertQueryResult(x));
}

function convertQueryResult<TQueryFnData = unknown, TData = TQueryFnData>(
  results: UseQueryResult<TData, string>,
): QueryResult<TData> {
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

export function getMutationAsyncResource<
  TData = unknown,
  TError = unknown,
  TVariables = unknown,
  TContext = unknown,
>(mutation: UseMutationResult<TData, TError, TVariables, TContext>): AsyncResource {
  if (mutation.isLoading) {
    return loading();
  }
  if (mutation.isError) {
    return failed(getErrorMessage(mutation.error));
  }
  return success(null);
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

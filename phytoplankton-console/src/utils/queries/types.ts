import { UseMutationResult } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query/src/types';
import type { QueryKey } from '@tanstack/query-core';
// Typed re-exports to avoid circular imports; keep a single import from hooks
import type { PaginatedData, CursorPaginatedData, PaginationParams } from '@/utils/queries/hooks';
import * as ar from '@/utils/asyncResource';
import { AsyncResource } from '@/utils/asyncResource';
// removed duplicate import of PaginationParams

export interface Cursor {
  prev?: string;
  next?: string;
  last?: string;
  hasNext?: boolean;
  hasPrev?: boolean;
  count?: number;
  limit?: number;
}
export interface QueryResult<Data> {
  data: ar.AsyncResource<Data>;
  refetch: () => void;
  paginate?: (params: PaginationParams) => Promise<Data>;
  loadingNext?: boolean;
  cursor?: ar.AsyncResource<Cursor>;
}

export function map<T, R>(
  res: QueryResult<T>,
  fn: (value: T) => R,
  loadingFn?: (lastValue: T | null) => R,
): QueryResult<R> {
  const { paginate, data, refetch } = res;
  return {
    data: ar.map(data, fn, loadingFn),
    refetch,
    paginate: paginate ? async (page) => fn(await paginate(page)) : undefined,
  };
}

export type Mutation<
  TData = unknown,
  TError = unknown,
  TVariables = unknown,
  TContext = unknown,
> = Pick<
  UseMutationResult<TData, TError, TVariables, TContext>,
  'mutate' | 'mutateAsync' | 'isLoading'
> & {
  dataResource: AsyncResource;
};

export type NavigationState = {
  isInitialised: boolean;
} | null;

// Shared TanStack Query options for our wrapped useQuery hooks
export type QueryOptions<
  TQueryFnData = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = Omit<
  UseQueryOptions<TQueryFnData, string, TData, TQueryKey>,
  'queryKey' | 'queryFn' | 'initialData'
> & {
  initialData?: () => undefined;
};

export type PaginatedQueryOptions<TData> = QueryOptions<PaginatedData<TData>, PaginatedData<TData>>;
export type CursorQueryOptions<TData> = QueryOptions<
  CursorPaginatedData<TData>,
  CursorPaginatedData<TData>
>;

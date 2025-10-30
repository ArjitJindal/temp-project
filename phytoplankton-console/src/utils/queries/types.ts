import { UseMutationResult } from '@tanstack/react-query';
import * as ar from '@/utils/asyncResource';
import { AsyncResource } from '@/utils/asyncResource';
import { PaginationParams } from '@/utils/queries/hooks';

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
  isRefreshing?: boolean;
  paginate?: (params: PaginationParams) => Promise<Data>;
  loadingNext?: boolean;
  cursor?: ar.AsyncResource<Cursor>;
}

export function map<T, R>(
  res: QueryResult<T>,
  fn: (value: T) => R,
  loadingFn?: (lastValue: T | null) => R,
): QueryResult<R> {
  const { paginate, data, refetch, isRefreshing } = res;
  return {
    data: ar.map(data, fn, loadingFn),
    refetch,
    isRefreshing,
    paginate: paginate ? async (page) => fn(await paginate(page)) : undefined,
  };
}

export type Mutation<
  TData = unknown,
  TError = unknown,
  TVariables = unknown,
  TContext = unknown,
> = Pick<UseMutationResult<TData, TError, TVariables, TContext>, 'mutate' | 'mutateAsync'> & {
  dataResource: AsyncResource;
};

export type NavigationState = {
  isInitialised: boolean;
} | null;

import * as ar from '@/utils/asyncResource';
import { PaginationParams } from '@/utils/queries/hooks';

export interface Cursor {
  fetchNextPage: () => string;
  fetchPreviousPage: () => string;
  fetchFirstPage: () => string;
  fetchLastPage: () => string;
  prev: string;
  next: string;
  last: string;
  from: string;
  hasNext: boolean;
  hasPrev: boolean;
  count: number;
  limit: number;
}
export interface QueryResult<Data> {
  data: ar.AsyncResource<Data>;
  refetch: () => void;
  paginate?: (params: PaginationParams) => Promise<Data>;
  loadingNext?: boolean;
  cursor?: Cursor;
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

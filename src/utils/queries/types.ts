import * as ar from '@/utils/asyncResource';
import { PaginationParams } from '@/utils/queries/hooks';

export interface CursorActions {
  fetchNextPage: () => string;
  fetchPreviousPage: () => string;
  fetchFirstPage: () => string;
  fetchLastPage: () => string;
}
export interface QueryResult<Data> {
  data: ar.AsyncResource<Data>;
  refetch: () => void;
  paginate?: (params: PaginationParams) => Promise<Data>;
  cursorActions?: CursorActions;
  prev?: string;
  next?: string;
  from?: string;
  loadingNext?: boolean;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
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

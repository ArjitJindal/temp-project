import { useState } from 'react';
import { QueryFunction, QueryKey } from '@tanstack/query-core';
import {
  useQueries as useQueriesRQ,
  useQuery as useQueryRQ,
  useInfiniteQuery as useInfiniteQueryRQ,
  UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { UseQueryOptions, UseQueryResult } from '@tanstack/react-query/src/types';
import { QueriesOptions } from '@tanstack/react-query/build/types/packages/react-query/src/useQueries';
import { InfiniteData } from '@tanstack/query-core/src/types';
import { useInterval } from 'ahooks';
import { getErrorMessage, neverThrow } from '@/utils/lang';
import { failed, loading, success, AsyncResource, init } from '@/utils/asyncResource';
import { QueryResult } from '@/utils/queries/types';
import { message } from '@/components/library/Message';

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
  const isQueryEnabled = options?.enabled ?? true;
  const results = useQueryRQ<TQueryFnData, string, TData, TQueryKey>(queryKey, queryFn, options);
  return convertQueryResult(results, isQueryEnabled);
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
  isQueryEnabled: boolean = true,
): QueryResult<TData> {
  if (!isQueryEnabled) {
    return {
      data: init(),
      refetch: results.refetch,
    };
  }
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
  next?: string;
};

export type CursorPaginatedData<T> = PaginatedData<T> & {
  next: string;
  prev: string;
  last: string;
  hasNext: boolean;
  hasPrev: boolean;
  count: number;
  limit: number;
};

export type PaginationParams = {
  pageSize: number;
  page?: number;
  from?: string;
  pagination?: boolean;
};

export type CursorPaginationParams = {
  from?: string;
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

export type CursorPaginatedQueryFunction<T = unknown> = (
  paginationParams: Partial<CursorPaginationParams>,
) => Promise<CursorPaginatedData<T>>;

export function useCursorQuery<TData = unknown, TQueryKey extends QueryKey = QueryKey>(
  queryKey: TQueryKey,
  queryFn: CursorPaginatedQueryFunction<TData>,
  options?: Omit<
    UseQueryOptions<CursorPaginatedData<TData>, string, CursorPaginatedData<TData>, TQueryKey>,
    'queryKey' | 'queryFn' | 'initialData'
  > & { initialData?: () => undefined },
): QueryResult<CursorPaginatedData<TData>> {
  const [pageParams, setPageParams] = useState({
    next: '',
    prev: '',
    last: '',
    hasNext: false,
    hasPrev: false,
    count: 0,
    limit: 0,
  });
  const [pageParam, setPageParam] = useState('');
  const results = useQuery<CursorPaginatedData<TData>, CursorPaginatedData<TData>, TQueryKey>(
    queryKey,
    () => {
      const result = queryFn({ from: pageParam });
      result.then((r) => {
        setPageParams(r);
      });
      return result;
    },
    {
      ...options,
      cacheTime: 0,
    },
  );
  const fetchPreviousPage = () => {
    setPageParam(pageParams.prev);
    return pageParams.prev;
  };
  const fetchNextPage = () => {
    setPageParam(pageParams.next);
    return pageParams.next;
  };
  const fetchFirstPage = () => {
    setPageParam('');
    return '';
  };
  const fetchLastPage = () => {
    setPageParam(pageParams.last);
    return pageParams.last;
  };

  return {
    ...results,
    paginate: queryFn,
    cursor: {
      ...pageParams,
      from: pageParam,
      fetchPreviousPage,
      fetchNextPage,
      fetchFirstPage,
      fetchLastPage,
    },
  };
}

export function getTotal(data: PaginatedData<unknown>): number {
  return data.total ?? data.items?.length ?? 0;
}

export function getPageCount(params: PaginationParams, data: PaginatedData<unknown>): number {
  const total = getTotal(data);
  if (params.pageSize) {
    return Math.ceil(total / params.pageSize);
  }
  return 0;
}

export function useInfiniteQuery<TData, TQueryKey extends QueryKey = QueryKey>(
  queryKey: TQueryKey,
  queryFn: QueryFunction<TData, TQueryKey>,
  options: {
    initialPageParam?: any;
    getNextPageParam?: (lastPage: any, allPages: any) => any;
    refetchInterval?: number | false | ((data, query) => number | false);
  },
) {
  const result = useInfiniteQueryRQ<TData, unknown, TData, TQueryKey>({
    queryKey,
    queryFn,
    ...options,
  });
  return convertInfiniteQueryResult(result);
}

function convertInfiniteQueryResult<TData>(results: UseInfiniteQueryResult<TData, unknown>): {
  data: AsyncResource<InfiniteData<TData>>;
  fetchNextPage: () => void;
  refetch: () => void;
  hasNext?: boolean;
} {
  let data: AsyncResource<InfiniteData<TData>>;
  if (results.isLoading) {
    data = loading<InfiniteData<TData>>(results.data ?? null);
  } else if (results.isFetching) {
    data = loading<InfiniteData<TData>>(results.data ?? null);
  } else if (results.isSuccess) {
    data = success<InfiniteData<TData>>(results.data);
  } else if (results.isError) {
    data = failed<InfiniteData<TData>>(getErrorMessage(results.error));
  } else {
    throw neverThrow(results, `Unhandled query result state. ${JSON.stringify(results)}`);
  }
  return {
    data,
    fetchNextPage: results.fetchNextPage,
    refetch: results.refetch,
    hasNext: results.hasNextPage,
  };
}

export function useNewUpdatesMessage(
  currentUpdatedAt: number | undefined,
  fetchNewUpdatedAt: () => Promise<number | undefined>,
  formatMessage: (lastUpdatedAt: number) => string,
  options?: { refetchIntervalSeconds?: number },
) {
  const [newUpdateMessageVisible, setNewUpdateMessageVisible] = useState(false);
  const [lastCheckedUpdatedAt, setLastCheckedUpdatedAt] = useState<number | null>(null);
  useInterval(async () => {
    const newUpdatedAt = await fetchNewUpdatedAt();
    if (
      currentUpdatedAt &&
      newUpdatedAt &&
      (lastCheckedUpdatedAt ?? currentUpdatedAt) < newUpdatedAt
    ) {
      if (!newUpdateMessageVisible) {
        message.info(formatMessage(newUpdatedAt), {
          duration: 24 * 60 * 60,
          onClose: () => setNewUpdateMessageVisible(false),
        });
        setNewUpdateMessageVisible(true);
      }
      setLastCheckedUpdatedAt(newUpdatedAt);
    }
  }, (options?.refetchIntervalSeconds ?? 60) * 1000);
}

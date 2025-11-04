import { useState } from 'react';
import { QueryFunction, QueryKey } from '@tanstack/query-core';
import {
  useInfiniteQuery as useInfiniteQueryRQ,
  UseInfiniteQueryResult,
  useQueries as useQueriesRQ,
  useQuery as useQueryRQ,
} from '@tanstack/react-query';
import { UseQueryOptions, UseQueryResult } from '@tanstack/react-query/src/types';
import { InfiniteData } from '@tanstack/query-core/src/types';
import { useInterval } from 'ahooks';
import { getErrorMessage, neverThrow } from '@/utils/lang';
import { AsyncResource, failed, init, loading, map, success } from '@/utils/asyncResource';
import { Cursor, QueryResult } from '@/utils/queries/types';
import { message } from '@/components/library/Message';
import { TableListViewEnum } from '@/apis';
import { NotFoundError } from '@/utils/errors';

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
  queries: UseQueryOptions<T>[];
  context?: UseQueryOptions['context'];
}): QueryResult<T>[] {
  const results = useQueriesRQ({ queries, context });
  return results.map((x: any) => convertQueryResult(x));
}

export function useQueryDataUpdatedAt<TQueryKey extends QueryKey = QueryKey>(key: TQueryKey) {
  const results = useQueryRQ(
    key,
    () => {
      throw new Error(
        `This query should never run, since it is used only as a stub for query observing`,
      );
    },
    {
      enabled: false,
    },
  );
  return results.dataUpdatedAt;
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
    let error = results.error as any;
    while (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      error = error.cause || error.originalError;
    }

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
  totalPages?: number;
  items: Array<T>;
  next?: string;
  pageSize?: number;
};

export type CursorPaginatedData<T> = PaginatedData<T> & {
  next: string | undefined;
  prev: string | undefined;
  last: string | undefined;
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
  view?: TableListViewEnum;
};

export type CursorPaginationParams = {
  from?: string;
  view?: TableListViewEnum;
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
  const results = useQuery<CursorPaginatedData<TData>, CursorPaginatedData<TData>, TQueryKey>(
    queryKey,
    () => {
      return queryFn({});
    },
    {
      ...options,
      cacheTime: 0,
    },
  );

  return {
    ...results,
    paginate: queryFn,
    cursor: map(
      results.data,
      (result): Cursor => ({
        next: result.next ?? '',
        prev: result.prev ?? '',
        last: result.last ?? '',
        hasNext: result.hasNext,
        hasPrev: result.hasPrev,
        count: result.count,
        limit: result.limit,
      }),
    ),
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
    // Check if the original error was a NotFoundError and re-throw it to bubble up to ErrorBoundary
    let error = results.error as any;
    while (error) {
      if (error instanceof NotFoundError || error?.name === 'NotFoundError') {
        throw error;
      }
      error = error.cause || error.originalError;
    }

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
          duration: 10,
          onClose: () => setNewUpdateMessageVisible(false),
        });
        setNewUpdateMessageVisible(true);
      }
      setLastCheckedUpdatedAt(newUpdatedAt);
    }
  }, (options?.refetchIntervalSeconds ?? 60) * 1000);
}

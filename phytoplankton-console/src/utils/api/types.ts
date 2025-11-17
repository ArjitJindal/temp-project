import { QueryKey, UseQueryOptions as QueryOptions } from '@tanstack/react-query';

export type UseQueryOptions<T> = Omit<
  QueryOptions<T, string, T, QueryKey>,
  'queryKey' | 'queryFn' | 'initialData'
> & {
  backgroundFetch?: boolean;
};

import * as ar from '@/utils/asyncResource';

export type QueryResult<Data> = {
  data: ar.AsyncResource<Data>;
  refetch: () => void;
};

export function map<T, R>(
  res: QueryResult<T>,
  fn: (value: T) => R,
  loadingFn?: (lastValue: T | null) => R,
): QueryResult<R> {
  return {
    data: ar.map(res.data, fn, loadingFn),
    refetch: res.refetch,
  };
}

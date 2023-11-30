import { UseMutationOptions } from '@tanstack/react-query/src/types';
import { MutationFunction } from '@tanstack/query-core';
import { useMutation as useMutationRQ } from '@tanstack/react-query';
import { Mutation } from '@/utils/queries/types';
import { getMutationAsyncResource } from '@/utils/queries/mutations/helpers';

export function useMutation<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown,
>(
  mutationFn: MutationFunction<TData, TVariables>,
  options?: Omit<UseMutationOptions<TData, TError, TVariables, TContext>, 'mutationFn'>,
): Mutation<TData, TError, TVariables, TContext> {
  const results = useMutationRQ<TData, TError, TVariables, TContext>(mutationFn, options);
  return {
    ...results,
    dataResource: getMutationAsyncResource<TData, TError, TVariables, TContext>(results),
  };
}

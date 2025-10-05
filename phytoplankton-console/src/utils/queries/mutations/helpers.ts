import type { MutateOptions } from '@tanstack/query-core/src/types';
import type { UseMutationResult } from '@tanstack/react-query/src/types';
import type { Mutation } from '@/utils/queries/types';
import { AsyncResource, init, loading, failed, success } from '@/utils/asyncResource';
import { getErrorMessage } from '@/utils/lang';

export function getMutationAsyncResource<
  TData = unknown,
  TError = unknown,
  TVariables = unknown,
  TContext = unknown,
>(mutation: UseMutationResult<TData, TError, TVariables, TContext>): AsyncResource<TData> {
  if (mutation.isIdle) {
    return init();
  }
  if (mutation.isLoading) {
    return loading();
  }
  if (mutation.isError) {
    return failed(getErrorMessage(mutation.error));
  }
  return success(mutation.data);
}

export function adaptMutationVariables<TData, TError, TVariables, TContext, TNewVariables>(
  mutation: Mutation<TData, TError, TVariables, TContext>,
  mapVariables: (variables: TNewVariables) => TVariables,
): Mutation<TData, TError, TNewVariables, TContext> {
  return {
    ...mutation,
    mutate: (
      variables: TNewVariables,
      options?: MutateOptions<TData, TError, TNewVariables, TContext>,
    ) => {
      let newOptions: MutateOptions<TData, TError, TVariables, TContext> | undefined = undefined;
      if (options) {
        newOptions = {};
        if (options.onSuccess) {
          newOptions.onSuccess = (data, _variables, context) => {
            options.onSuccess?.(data, variables, context);
          };
        }
        if (options.onError) {
          newOptions.onError = (error, _variables, context) => {
            options.onError?.(error, variables, context);
          };
        }
        if (options.onSettled) {
          newOptions.onSettled = (data, error, _variables: TVariables, context) => {
            options.onSettled?.(data, error, variables, context);
          };
        }
      }
      mutation.mutate(mapVariables(variables), newOptions);
    },
    mutateAsync: async (variables, options): Promise<TData> => {
      let newOptions: MutateOptions<TData, TError, TVariables, TContext> | undefined = undefined;
      if (options) {
        newOptions = {};
        if (options.onSuccess) {
          newOptions.onSuccess = (data, _variables, context) => {
            options.onSuccess?.(data, variables, context);
          };
        }
        if (options.onError) {
          newOptions.onError = (error, _variables, context) => {
            options.onError?.(error, variables, context);
          };
        }
        if (options.onSettled) {
          newOptions.onSettled = (data, error, _variables: TVariables, context) => {
            options.onSettled?.(data, error, variables, context);
          };
        }
      }
      return mutation.mutateAsync(mapVariables(variables), newOptions);
    },
  };
}

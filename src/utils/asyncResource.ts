import { useEffect, useState } from 'react';
import { usePrevious } from './hooks';
import { neverThrow } from './lang';

export interface Init {
  readonly kind: 'INIT';
}

export interface Loading<V> {
  readonly kind: 'LOADING';
  readonly lastValue: V | null;
}

export interface Success<T> {
  readonly kind: 'SUCCESS';
  readonly value: T;
}

export interface Failed<V> {
  readonly kind: 'FAILED';
  readonly message: string;
  readonly lastValue: V | null;
}

export type AsyncResource<T = unknown> = Init | Loading<T> | Success<T> | Failed<T>;

export function init<T>(): AsyncResource<T> {
  return {
    kind: 'INIT',
  };
}

export function loading<T>(lastValue: T | null = null): AsyncResource<T> {
  return {
    kind: 'LOADING',
    lastValue,
  };
}

export function success<T>(value: T): AsyncResource<T> {
  return {
    kind: 'SUCCESS',
    value,
  };
}

export function failed<T>(message: string, lastValue: T | null = null): AsyncResource<T> {
  return {
    kind: 'FAILED',
    message,
    lastValue,
  };
}

export function isInit<T>(resource: AsyncResource<T>): resource is Init {
  return resource.kind === 'INIT';
}

export function isLoading<T>(resource: AsyncResource<T>): resource is Loading<T> {
  return resource.kind === 'LOADING';
}

export function isSuccess<T>(resource: AsyncResource<T>): resource is Success<T> {
  return resource.kind === 'SUCCESS';
}

export function isFailed<T>(resource: AsyncResource<T>): resource is Failed<T> {
  return resource.kind === 'FAILED';
}

export function match<T, R>(
  asyncResource: AsyncResource<T>,
  callbacks: {
    init: () => R;
    success: (value: T) => R;
    loading: (lastValue: T | null) => R;
    failed: (message: string, lastValue: T | null) => R;
  },
): R {
  switch (asyncResource.kind) {
    case 'INIT':
      return callbacks.init();
    case 'SUCCESS':
      return callbacks.success(asyncResource.value);
    case 'LOADING':
      return callbacks.loading(asyncResource.lastValue);
    case 'FAILED':
      return callbacks.failed(asyncResource.message, asyncResource.lastValue);
  }
  throw neverThrow(asyncResource);
}

export function map<T, R>(
  asyncResource: AsyncResource<T>,
  fn: (value: T) => R,
  loadingFn?: (lastValue: T | null) => R,
): AsyncResource<R> {
  try {
    switch (asyncResource.kind) {
      case 'SUCCESS':
        return success(fn(asyncResource.value));
      case 'LOADING': {
        let lastValue: R | null = null;
        if (asyncResource.lastValue != null) {
          if (loadingFn != null) {
            lastValue = loadingFn(asyncResource.lastValue);
          } else {
            lastValue = fn(asyncResource.lastValue);
          }
        }
        return loading(lastValue);
      }
      case 'FAILED': {
        let lastValue: R | null = null;
        if (asyncResource.lastValue != null) {
          if (loadingFn != null) {
            lastValue = loadingFn(asyncResource.lastValue);
          } else {
            lastValue = fn(asyncResource.lastValue);
          }
        }
        return failed(asyncResource.message, lastValue);
      }
    }
  } catch (e: unknown) {
    let message = 'Unknown error';
    if (e instanceof Error && e.message) {
      message = e.message;
    }
    return failed<R>(message);
  }
  return asyncResource;
}

export function getOr<T>(asyncResource: AsyncResource<T>, defaultValue: T): T {
  switch (asyncResource.kind) {
    case 'SUCCESS':
      return asyncResource.value;
    case 'LOADING':
      if (asyncResource.lastValue != null) {
        return asyncResource.lastValue;
      }
      break;
    case 'FAILED':
      if (asyncResource.lastValue != null) {
        return asyncResource.lastValue;
      }
      break;
  }
  return defaultValue;
}

/* Helpers */
export function useFinishedLoading<T>(resource: AsyncResource<T>): boolean {
  const wasLoading = usePrevious(isLoading(resource)) || false;
  const nowLoading = isLoading(resource);
  return wasLoading && !nowLoading;
}

export function useStartedLoading<T>(resource: AsyncResource<T>): boolean {
  const wasLoading = usePrevious(isLoading(resource)) || false;
  const nowLoading = isLoading(resource);
  return !wasLoading && nowLoading;
}

export function useFinishedSuccessfully<T>(resource: AsyncResource<T>): boolean {
  const wasLoading = usePrevious(isLoading(resource));
  const isSuccessNow = isSuccess(resource);
  return wasLoading == true && isSuccessNow;
}

export function useFinishedFailed<T>(resource: AsyncResource<T>): boolean {
  const wasLoading = usePrevious(isLoading(resource));
  const isErrorNow = isFailed(resource);
  return wasLoading == true && isErrorNow;
}

export function useLastSuccessValue<T>(resource: AsyncResource<T>, defaultValue: T): T {
  const value = getOr(resource, defaultValue);

  const isResSuccess = isSuccess(resource);
  const [result, setResult] = useState(value);

  useEffect(() => {
    if (isResSuccess) {
      setResult(value);
    }
  }, [isResSuccess, value]);

  return result;
}

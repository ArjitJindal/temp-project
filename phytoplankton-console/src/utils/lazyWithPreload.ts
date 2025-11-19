import React from 'react';

type ComponentModule<T = any> = {
  default: React.ComponentType<T>;
};

type LazyComponentWithPreload<T = any> = React.LazyExoticComponent<React.ComponentType<T>> & {
  preload: () => Promise<void>;
};

/**
 * Wrapper around React.lazy that adds a preload method for route preloading
 * @param importFn - Function that returns a promise resolving to a component module
 * @returns Lazy component with a preload method
 */
export function lazyWithPreload<T = any>(
  importFn: () => Promise<ComponentModule<T>>,
): LazyComponentWithPreload<T> {
  let preloadPromise: Promise<void> | null = null;

  const preload = (): Promise<void> => {
    if (!preloadPromise) {
      preloadPromise = importFn()
        .then(() => {})
        .catch(() => {
          preloadPromise = null;
        });
    }
    return preloadPromise;
  };

  const LazyComponent = React.lazy(importFn) as LazyComponentWithPreload<T>;

  LazyComponent.preload = preload;

  return LazyComponent;
}

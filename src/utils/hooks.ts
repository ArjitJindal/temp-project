import { EffectCallback, useCallback, useEffect, useRef } from 'react';
import _ from 'lodash';
import { isEqual } from '@/utils/lang';

export function usePrevious<T>(value: T): T | null {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current || null;
}

export function useDeepEqualEffect(effect: EffectCallback, deps: unknown[]) {
  const prevDeps = usePrevious(deps);
  const depsChanged = !isEqual(prevDeps, deps);
  useEffect(() => {
    if (depsChanged) {
      return effect();
    }
  }, [effect, depsChanged]);
}

export const useTableScrollVisible = (
  setVisible: React.Dispatch<React.SetStateAction<boolean>>,
) => {
  const handleScroll = useCallback(() => {
    setVisible(false);
  }, [setVisible]);

  useEffect(() => {
    const tableRoot = document.querySelector('.ant-pro-table');
    if (tableRoot) {
      tableRoot.addEventListener('scroll', _.throttle(handleScroll, 100));
    }
    return () => {
      if (tableRoot) {
        tableRoot.removeEventListener('scroll', handleScroll);
      }
    };
  }, [handleScroll]);
};

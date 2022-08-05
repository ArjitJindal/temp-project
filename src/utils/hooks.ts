import { EffectCallback, useEffect, useRef } from 'react';
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

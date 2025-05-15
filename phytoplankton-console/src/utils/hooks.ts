import { EffectCallback, useEffect, useRef, useState } from 'react';
import { customAlphabet } from 'nanoid/non-secure';
import { useSearchParams } from 'react-router-dom';
import { useLocalStorageState } from 'ahooks';
import { SetState } from 'ahooks/lib/createUseStorageState';
import { isEqual } from '@/utils/lang';

const nanoid = customAlphabet('1234567890abcdef', 16);

export function usePrevious<T>(value: T): T | null {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current ?? null;
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

export function useDeepEqualMemo<T>(factory: () => T, deps: unknown[]): T {
  const [state, setState] = useState(factory);
  const prevDeps = usePrevious(deps);
  const depsChanged = !isEqual(prevDeps, deps);
  useEffect(() => {
    if (depsChanged) {
      setState(factory);
    }
  }, [factory, depsChanged]);
  return state;
}

export function useId(prefix = `id`): string {
  const [id] = useState(nanoid());
  return prefix + id;
}

export function useFocusKey() {
  const [searchParams] = useSearchParams();
  return searchParams.get('focus');
}

export function useScrollToFocus() {
  const scrolledRef = useRef(false);
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('focus');

  useEffect(() => {
    if (!focusId || scrolledRef.current) {
      return;
    }

    const element = document.getElementById(focusId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      scrolledRef.current = true;
    }
  });
}

export function useIsChanged<T>(value: T): boolean {
  const prev = usePrevious(value);
  return !isEqual(prev, value);
}

export function useSafeLocalStorageState<T>(
  key: string,
  defaultValue: T,
): [T, (value?: SetState<T> | undefined) => void] {
  const [value, setRawValue] = useLocalStorageState<T>(key, {
    defaultValue,
  });

  return [value ?? defaultValue, setRawValue];
}

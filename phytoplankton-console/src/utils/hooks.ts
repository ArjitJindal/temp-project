import { EffectCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
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
  listenStorageChange: boolean = false,
): [T, (value?: SetState<T> | undefined) => void] {
  const [value, setRawValue] = useLocalStorageState<T>(key, {
    defaultValue,
    listenStorageChange,
  });

  return [value ?? defaultValue, setRawValue];
}

type NavigationGuardRequest = { type: 'back' } | { type: 'url'; url: string } | { type: 'custom' };

export function useNavigationGuard(options: {
  isDirty: boolean;
  enabled?: boolean;
  onConfirmCustom?: () => void;
}) {
  const { isDirty, enabled = true, onConfirmCustom } = options;
  const navigate = useNavigate();

  const isDirtyRef = useRef<boolean>(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const [isVisible, setIsVisible] = useState(false);
  const pendingRef = useRef<NavigationGuardRequest | null>(null);
  const allowNavigationRef = useRef<boolean>(false);

  // Warn before closing the tab or reloading when there are unsaved changes
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled]);

  // Intercept browser back navigation to show confirm modal
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const stateMarker = { __nav_guard__: true };
    window.history.pushState(stateMarker, document.title);
    const onPopState = () => {
      if (isDirtyRef.current && !allowNavigationRef.current) {
        window.history.pushState(stateMarker, document.title);
        pendingRef.current = { type: 'back' };
        setIsVisible(true);
        return;
      }
      allowNavigationRef.current = false;
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [enabled]);

  // Intercept internal anchor navigations (e.g., menu/links) to confirm leaving
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const onDocumentClick = (event: MouseEvent) => {
      if (!isDirtyRef.current) {
        return;
      }
      if (event.defaultPrevented) {
        return;
      }
      // Only left-clicks without modifier keys
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      let el = event.target as HTMLElement | null;
      while (el && el !== document.body) {
        if (el instanceof HTMLAnchorElement && el.href) {
          const href = el.getAttribute('href');
          if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
            return;
          }
          const targetUrl = new URL(el.href, window.location.origin);
          const current = window.location;
          const isSameLocation =
            targetUrl.pathname === current.pathname &&
            targetUrl.search === current.search &&
            targetUrl.hash === current.hash;
          if (isSameLocation) {
            return;
          }

          event.preventDefault();
          pendingRef.current = { type: 'url', url: el.href };
          setIsVisible(true);
          return;
        }
        el = el.parentElement;
      }
    };

    document.addEventListener('click', onDocumentClick, true);
    return () => {
      document.removeEventListener('click', onDocumentClick, true);
    };
  }, [enabled]);

  const triggerConfirmForClose = () => {
    if (!enabled || !isDirtyRef.current) {
      if (onConfirmCustom) {
        onConfirmCustom();
      }
      return;
    }
    pendingRef.current = { type: 'custom' };
    setIsVisible(true);
  };

  const confirm = () => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    setIsVisible(false);
    if (!pending) {
      return;
    }
    if (pending.type === 'back') {
      allowNavigationRef.current = true;
      window.history.back();
      return;
    }
    if (pending.type === 'url') {
      try {
        const parsed = new URL(pending.url, window.location.origin);
        const isSameOrigin = parsed.origin === window.location.origin;
        if (isSameOrigin) {
          navigate(parsed.pathname + parsed.search + parsed.hash);
        } else {
          window.location.href = pending.url;
        }
      } catch {
        window.location.href = pending.url;
      }
      return;
    }
    if (pending.type === 'custom') {
      if (onConfirmCustom) {
        onConfirmCustom();
      }
    }
  };

  const cancel = () => {
    pendingRef.current = null;
    setIsVisible(false);
  };

  return { isConfirmVisible: isVisible, confirm, cancel, triggerConfirmForClose };
}

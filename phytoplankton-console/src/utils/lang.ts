/*
 IMPORTANT: These two functions accept 'never' parameter for a reason, they are
 used to implement exhaustive pattern matching in TS. Details:
 https://stackoverflow.com/a/39419171/916330
 */
export function neverThrow(obj: never, message?: string): never {
  throw new Error(message ?? 'Should never happen');
}
export function neverReturn<T>(obj: never, defaultValue: T): T {
  return defaultValue;
}

export function getErrorMessage(e: unknown) {
  if (typeof e === 'string' && e !== '') {
    return e;
  }
  if (e instanceof TypeError && e.message === 'Failed to fetch') {
    return 'Unable to communicate with our servers.';
  }
  if (typeof e === 'object' && e != null && 'message' in e) {
    return (e as any).message ?? 'Unknown error';
  }
  return 'Unknown error';
}

export function isEqual<T>(a: T, b: T): boolean {
  if (a == null || b == null) {
    return a == b; // For null to be equal to undefined
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (Array.isArray(a)) {
    const _b = b as unknown as Array<unknown>;
    if (a.length !== _b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      const a1 = a[i];
      const b1 = b[i];
      if (!isEqual(a1, b1)) {
        return false;
      }
    }
    return true;
  }
  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) {
      return false;
    }
    for (let i = 0; i < keysA.length; i += 1) {
      const key = keysA[i];
      const a1 = a[key];
      const b1 = b[key];
      if (!isEqual(a1, b1)) {
        return false;
      }
    }
    return true;
  }
  return a === b;
}

export type SparseArray<T> = (T | undefined | null | false)[];

export function denseArray<T>(array: SparseArray<T>): T[] {
  return array.filter((x): x is T => x != null && x !== false);
}

export function objectKeys<T extends object>(obj: T): (keyof T)[] {
  return Object.keys(obj) as (keyof T)[];
}

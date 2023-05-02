// https://basarat.gitbooks.io/typescript/docs/types/never.html
export function neverThrow(obj: never, message?: string): never {
  throw new Error(message ?? 'Should never happen');
}

export function neverReturn<T>(obj: never, defaultValue: T): T {
  return defaultValue;
}

export function getErrorMessage(e: unknown) {
  if (typeof e === 'object' && e != null && 'message' in e) {
    return (e as any).message ?? 'Unknown error';
  }
  return 'Unknown error';
}

export function isEqual<T>(a: T, b: T): boolean {
  if (a == null || b == null) {
    return a === b;
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

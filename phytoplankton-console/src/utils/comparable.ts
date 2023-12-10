/*
  Helper types and utils for them to make it possible implement components
  like Select in a generic way with support of non-string values
 */
export type Comparable = string | number | boolean | undefined | null;

export function key(a: Comparable): string {
  if (a === null) {
    return 'null';
  }
  if (a === undefined) {
    return 'undefined';
  }
  return a.toString();
}

export function compare(a: Comparable, b: Comparable): boolean {
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a.toLocaleLowerCase() === b.toLocaleLowerCase();
  }
  return a === b;
}

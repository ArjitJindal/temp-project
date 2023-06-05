export async function everyAsync<T>(
  arr: T[],
  predicate: (e: T) => Promise<boolean>
) {
  for (const e of arr) {
    if (!(await predicate(e))) {
      return false
    }
  }
  return true
}

export function notNullish<T>(value: T | undefined | null): value is T {
  return value != null
}

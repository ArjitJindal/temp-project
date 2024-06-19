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

export async function fromAsync<T>(it: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = []
  for await (const item of it) {
    result.push(item)
  }
  return result
}

export function notNullish<T>(value: T | undefined | null): value is T {
  return value != null
}

export function notEmpty<T>(
  value: T | undefined | null | false | ''
): value is T {
  return notNullish(value) && value !== false && value !== ''
}

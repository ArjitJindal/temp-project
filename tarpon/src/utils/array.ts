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

type SimpleValue = boolean | string | number | null | undefined

export function isSimpleValue(value: unknown): value is SimpleValue {
  return (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

export function getAddedItems(oldArr: string[], newArr: string[]) {
  const count = (arr: string[]) => {
    const map = new Map<string, number>()
    for (const item of arr) {
      map.set(item, (map.get(item) || 0) + 1)
    }
    return map
  }

  const oldCount = count(oldArr)
  const newCount = count(newArr)

  const added: string[] = []

  for (const [item, newQty] of newCount.entries()) {
    const oldQty = oldCount.get(item) || 0
    if (newQty > oldQty) {
      for (let i = 0; i < newQty - oldQty; i++) {
        added.push(item)
      }
    }
  }

  return added
}

export function parseStrings<T = string>(
  raw: string | undefined | null
): T[] | undefined {
  if (raw == null || raw === '') {
    return undefined
  }
  return raw.split(',').filter((x) => x !== '') as unknown as T[]
}

import stringifySafe from 'json-stringify-safe'

export function memoizePromise<T extends (...args: any[]) => Promise<any>>(
  fn: T
): (...args: Parameters<T>) => ReturnType<T> {
  const cache = new Map<string, Promise<any>>()

  return (...args: Parameters<T>): ReturnType<T> => {
    const key = stringifySafe(args)

    if (!cache.has(key)) {
      const promise = fn(...args).catch((err) => {
        cache.delete(key) // Remove cache on failure so it can retry
        throw err
      })
      cache.set(key, promise)
    }

    return cache.get(key) as ReturnType<T>
  }
}

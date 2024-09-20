import { LRUCache } from 'lru-cache'
import { generateChecksum } from './object'
import { envIs } from './env'

// NOTE: In-memory cache only works if an invocation uses a "warm" lambdas. And the cache is not
// shared between different lambdas. We'll need a proper distributed cache like Redis to optimize
// for cache hits and enable cache invalidation.
export function createNonConsoleApiInMemoryCache<V extends object>(options: {
  max: number
  ttlMinutes: number
}): LRUCache<string, V> | null {
  if (
    envIs('test', 'local') ||
    // Don't cache for ConsoleApi lambdas
    process.env.AWS_LAMBDA_FUNCTION_NAME?.includes('ConsoleApi')
  ) {
    return null
  }
  return new LRUCache<string, V>({
    max: options.max,
    ttl: options.ttlMinutes * 60 * 1000,
    updateAgeOnGet: true,
  })
}

export function getInMemoryCacheKey(...args: any[]) {
  return generateChecksum(args)
}

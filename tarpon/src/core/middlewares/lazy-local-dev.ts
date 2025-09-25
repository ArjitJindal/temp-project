/* eslint-disable @typescript-eslint/no-explicit-any */
import { envIs } from '@/utils/env'

// Lazy-loaded localDev middleware
export const createLazyLocalDev = () => {
  let localDevMiddleware: any = null

  return (handler: any) => async (event: any, context: any, callback: any) => {
    // Only load localDev middleware in local or test environments
    if (!envIs('local') && !envIs('test')) {
      return handler(event, context, callback)
    }

    if (!localDevMiddleware) {
      const { localDev } = await import('@/core/middlewares/local-dev')
      localDevMiddleware = localDev()
    }
    return localDevMiddleware(handler)(event, context, callback)
  }
}

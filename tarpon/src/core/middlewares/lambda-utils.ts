import { logger } from '../logger'
import { getContext } from '../utils/context-storage'

let registered = false

// NO.TE: By default, lambda will terminate the program if there's a unhandled promise rejection
// We override this behavior and catch it here and just log the error.
export function registerUnhandledErrorHandler() {
  if (registered) {
    return
  }
  registered = true
  process.removeAllListeners('unhandledRejection')
  process.on('unhandledRejection', (reason) => {
    const contextTraceId = getContext()?.rawTraceId
    const currentTraceId = process.env._X_AMZN_TRACE_ID
    if (contextTraceId !== currentTraceId) {
      logger.warn(
        `The current context's trace ID (${contextTraceId}) is different than the current one (${currentTraceId})`
      )
      return
    }
    logger.error(`Unhandled Promise Rejection: ${reason}`, reason)
  })
}

import { logger } from '../logger'

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
    logger.error(`Unhandled Promise Rejection: ${reason}`, reason)
  })
}

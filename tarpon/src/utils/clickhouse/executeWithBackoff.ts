import { BackoffOptions, backOff } from 'exponential-backoff'
import { logger } from '@/core/logger'

const DEFAULT_BACKOFF_OPTIONS: BackoffOptions = {
  numOfAttempts: 10,
  maxDelay: 240000,
  startingDelay: 10000,
  timeMultiple: 2,
  jitter: 'full',
}
export async function executeWithBackoff<T>(
  operation: () => Promise<T>,
  operationName: string,
  context?: Record<string, unknown>,
  backoffOptions?: Partial<BackoffOptions>
): Promise<T> {
  const options = { ...DEFAULT_BACKOFF_OPTIONS, ...backoffOptions }

  return backOff(operation, {
    ...options,
    retry: (error, attemptNumber) => {
      logger.warn(
        `ClickHouse ${operationName} failed, retrying... Attempt ${attemptNumber}: ${error.message}`,
        { error, attemptNumber, operationName, ...context }
      )
      return true
    },
  })
}

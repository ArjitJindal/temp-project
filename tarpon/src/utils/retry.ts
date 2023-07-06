import { logger } from '@/core/logger'

export async function exponentialRetry<T>(
  fn: () => Promise<T>,
  warningString = 'Retrying...',
  retries = 10,
  delay = 1000
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (retries === 0) {
      throw error
    }
    logger.warn(
      `${warningString} Retrying in ${
        delay / 1000
      } seconds..., Retries left: ${retries}, Error: ${
        (error as Error).message
      }`
    )
    await new Promise((resolve) => setTimeout(resolve, delay))
    return await exponentialRetry<T>(fn, warningString, retries - 1, delay * 2)
  }
}

// Usage:
/*
    const result = await exponentialRetry(async () => {
        return await someAsyncFunction()
    })
*/

import { logger } from '../logger'

export const genericErrorHandler =
  () =>
  (handler: CallableFunction): CallableFunction =>
  async (event: unknown, context: unknown): Promise<unknown> => {
    try {
      return await handler(event, context)
    } catch (error) {
      logger.error(error)
      throw error
    }
  }

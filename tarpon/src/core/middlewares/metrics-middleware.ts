import { publishContextMetrics } from '@/core/utils/context'

export const metricsMiddleware =
  () =>
  (handler: CallableFunction): CallableFunction =>
  async (event: unknown, context: unknown): Promise<unknown> => {
    const response = await handler(event, context)
    if (process.env.ENV === 'local') {
      return response
    }
    await publishContextMetrics()
    return response
  }

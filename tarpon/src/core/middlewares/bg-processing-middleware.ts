import { initBackground, waitForTasks } from '@/utils/background'

export const bgProcessingMiddleware =
  () =>
  (handler: CallableFunction): CallableFunction =>
  async (event: unknown, context: unknown): Promise<unknown> => {
    initBackground()
    const response = await handler(event, context)
    await waitForTasks()
    return response
  }

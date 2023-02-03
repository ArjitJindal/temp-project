import {
  CloudWatchClient,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch'
import { logger } from '@/core/logger'
import { getContext } from '@/core/utils/context'

export const metricsMiddleware =
  () =>
  (handler: CallableFunction): CallableFunction =>
  async (event: unknown, context: unknown): Promise<unknown> => {
    const response = await handler(event, context)

    // Publish metrics for each namespace to cloudwatch
    try {
      const isLocal = process.env.ENV === 'local'
      const client = new CloudWatchClient({
        region: isLocal ? 'local' : process.env.AWS_REGION,
      })
      const metrics = getContext()?.metrics
      if (metrics) {
        await Promise.all(
          Object.keys(metrics).map((ns) => {
            return client.send(
              new PutMetricDataCommand({
                Namespace: ns,
                MetricData: metrics[ns],
              })
            )
          })
        )
      }
    } catch (err) {
      logger.warn(`Error sending metrics`, err)
    }
    return response
  }

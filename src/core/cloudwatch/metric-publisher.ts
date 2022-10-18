import {
  CloudWatchClient,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch'
import { getContext } from '../utils/context'
import { Metric } from './metrics'
import { logger } from '@/core/logger'

export class MetricPublisher {
  private client: CloudWatchClient

  constructor() {
    const isLocal = process.env.ENV === 'local'
    this.client = new CloudWatchClient({
      region: isLocal ? 'local' : process.env.AWS_REGION,
    })
  }

  public async publicMetric(
    metric: Metric,
    value: number,
    dimensions?: { [key: string]: string }
  ) {
    const dimensionsWithContext = {
      ...getContext()?.metricDimensions,
      ...dimensions,
    }
    if (process.env.ENV === 'local') {
      console.log('Publishing metric: ', metric, value, dimensionsWithContext)
      return
    }
    try {
      await this.client.send(
        new PutMetricDataCommand({
          Namespace: metric.namespace,
          MetricData: [
            {
              MetricName: metric.name,
              Dimensions: Object.entries(dimensionsWithContext || {}).map(
                (entry) => ({
                  Name: entry[0],
                  Value: entry[1],
                })
              ),
              Unit: 'None',
              Value: value,
              Timestamp: new Date(),
            },
          ],
        })
      )
    } catch (err) {
      logger.warn(`Error sending metric ${metric.name}`, err)
    }
  }
}

import {
  CloudWatchClient,
  MetricDatum,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch'
import groupBy from 'lodash/groupBy'
import unidecode from 'unidecode'
import { logger } from '../logger'
import dayjs from '@/utils/dayjs'
import { MetricsData } from '@/@types/cloudwatch'

export const publishMetrics = async (metrics: Array<MetricsData>) => {
  if (process.env.ENV === 'local') {
    return
  }
  const cloudWatchClient = new CloudWatchClient({
    region: process.env.AWS_REGION,
  })

  const metricData = metrics
    .map(({ metric, value, dimensions, timestamp }) => {
      const Timestamp = timestamp ? new Date(timestamp) : new Date()
      // NOTE: Timestamp must specify a time within the past two weeks
      if (dayjs().subtract(2, 'week').valueOf() > Timestamp.valueOf()) {
        return null
      }
      return {
        MetricName: metric.name,
        Dimensions: dimensions?.map((dimension) => ({
          Name: unidecode(dimension.Name ?? ''),
          Value: unidecode(dimension.Value ?? ''),
        })),
        Timestamp,
        Unit: 'Count',
        Value: value,
        Namespace: metric.namespace,
      }
    })
    .filter(Boolean) as Array<MetricDatum & { Namespace: string }>

  const metricsByNamespace = groupBy(metricData, 'Namespace')

  for (const [namespace, metrics] of Object.entries(metricsByNamespace)) {
    try {
      await cloudWatchClient.send(
        new PutMetricDataCommand({
          MetricData: metrics,
          Namespace: namespace,
        })
      )
    } catch (e) {
      logger.error(`Error publishing metrics: ${(e as Error)?.message}`, {
        namespace,
        metrics: JSON.stringify(metrics),
      })
    }
  }
}

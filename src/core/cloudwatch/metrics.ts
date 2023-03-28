import {
  CloudWatchClient,
  Dimension,
  MetricDatum,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch'
import _ from 'lodash'
import { logger } from '../logger'

export type Metric = {
  namespace: string
  name: string
}

export type MetricsData = {
  metric: Metric
  value: number
  dimensions?: Array<Dimension>
}

export const DYNAMODB_READ_CAPACITY_METRIC: Metric = {
  namespace: 'flagright/DynamoDB',
  name: 'ConsumedReadCapacityUnits',
}

export const DYNAMODB_WRITE_CAPACITY_METRIC: Metric = {
  namespace: 'flagright/DynamoDB',
  name: 'ConsumedWriteCapacityUnits',
}

export const RULE_EXECUTION_TIME_MS_METRIC: Metric = {
  namespace: 'flagright/RulesEngine',
  name: 'RuleExecutionTimeMs',
}

export const TRANSACTIONS_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: 'TransactionsCount',
}

export const TRANSACTION_EVENTS_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: 'TransactionEventsCount',
}

export const USERS_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: 'UsersCount',
}

export const ACTIVE_RULE_INSTANCES_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: 'ActiveRuleInstancesCount',
}

export const publishMetrics = async (metrics: Array<MetricsData>) => {
  const cloudWatchClient = new CloudWatchClient({
    region: process.env.AWS_REGION,
  })

  const metricData: Array<MetricDatum & { Namespace: string }> = metrics.map(
    ({ metric, value, dimensions }) => {
      return {
        MetricName: metric.name,
        Dimensions: dimensions,
        Timestamp: new Date(),
        Unit: 'Count',
        Value: value,
        Namespace: metric.namespace,
      }
    }
  )

  logger.info(`Metric data: ${JSON.stringify(metricData)}`)

  const metricsByNamespace = _.groupBy(metricData, 'Namespace')

  for (const [namespace, metrics] of Object.entries(metricsByNamespace)) {
    logger.info(
      `Publishing metrics to CloudWatch: ${JSON.stringify(
        metrics
      )} for namespace: ${namespace}`
    )

    await cloudWatchClient.send(
      new PutMetricDataCommand({
        MetricData: metrics,
        Namespace: namespace,
      })
    )
  }
}

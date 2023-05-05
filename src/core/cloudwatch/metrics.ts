import {
  CloudWatchClient,
  Dimension,
  MetricDatum,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch'
import _ from 'lodash'
import unidecode from 'unidecode'
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

export const CUSTOM_API_USAGE_METRIC_NAMES = {
  TRANSACTION_COUNT_METRIC_NAME: 'TransactionsCount',
  TRANSACTION_EVENTS_COUNT_METRIC_NAME: 'TransactionEventsCount',
  USERS_COUNT_METRIC_NAME: 'UsersCount',
  ACTIVE_RULE_INSTANCES_COUNT_METRIC_NAME: 'ActiveRuleInstancesCount',
  SANCTIONS_SEARCHES_COUNT_METRIC_NAME: 'SanctionsSearchesCount',
  TENANT_SEATS_COUNT_METRIC_NAME: 'TenantSeatsCount',
  IBAN_RESOLUTION_COUNT_METRIC_NAME: 'IbanResolutionsCount',
}

export const TRANSACTIONS_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.TRANSACTION_COUNT_METRIC_NAME,
}

export const SANCTIONS_SEARCHES_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.SANCTIONS_SEARCHES_COUNT_METRIC_NAME,
}

export const IBAN_RESOLUTION_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.IBAN_RESOLUTION_COUNT_METRIC_NAME,
}

export const TENANT_SEATS_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.TENANT_SEATS_COUNT_METRIC_NAME,
}

export const TRANSACTION_EVENTS_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.TRANSACTION_EVENTS_COUNT_METRIC_NAME,
}

export const USERS_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.USERS_COUNT_METRIC_NAME,
}

export const ACTIVE_RULE_INSTANCES_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.ACTIVE_RULE_INSTANCES_COUNT_METRIC_NAME,
}

export const publishMetrics = async (metrics: Array<MetricsData>) => {
  if (process.env.ENV === 'local') {
    return
  }
  const cloudWatchClient = new CloudWatchClient({
    region: process.env.AWS_REGION,
  })

  const metricData: Array<MetricDatum & { Namespace: string }> = metrics.map(
    ({ metric, value, dimensions }) => {
      return {
        MetricName: metric.name,
        Dimensions: dimensions?.map((dimension) => ({
          Name: unidecode(dimension.Name ?? ''),
          Value: unidecode(dimension.Value ?? ''),
        })),
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

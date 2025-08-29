import {
  CloudWatchClient,
  Dimension,
  MetricDatum,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch'
import { groupBy } from 'lodash'

import unidecode from 'unidecode'
import { logger } from '../logger'
import dayjs from '@/utils/dayjs'

export type Metric = {
  namespace: string
  name: string
  kind: 'GAUGE' | 'CULMULATIVE'
}

export type MetricsData = {
  metric: Metric
  value: number
  dimensions?: Array<Dimension>
  timestamp?: number
}

export const DYNAMODB_READ_CAPACITY_METRIC: Metric = {
  namespace: 'flagright/DynamoDB',
  name: 'ConsumedReadCapacityUnits',
  kind: 'CULMULATIVE',
}

export const DYNAMODB_WRITE_CAPACITY_METRIC: Metric = {
  namespace: 'flagright/DynamoDB',
  name: 'ConsumedWriteCapacityUnits',
  kind: 'CULMULATIVE',
}
export const RuleEngineNamespace = 'flagright/RulesEngine'

export const RULE_EXECUTION_TIME_MS_METRIC: Metric = {
  namespace: RuleEngineNamespace,
  name: 'RuleExecutionTimeMs',
  kind: 'GAUGE',
}

export const RULE_HIT_PERCENTAGE: Metric = {
  namespace: RuleEngineNamespace,
  name: 'RuleHitPercentage',
  kind: 'GAUGE',
}

export const RULE_ERROR_COUNT_METRIC: Metric = {
  namespace: RuleEngineNamespace,
  name: 'RuleErrorCount',
  kind: 'CULMULATIVE',
}

export const CUSTOM_API_USAGE_METRIC_NAMES = {
  TRANSACTION_COUNT_METRIC_NAME: 'TransactionsCount',
  TRANSACTION_EVENTS_COUNT_METRIC_NAME: 'TransactionEventsCount',
  USERS_COUNT_METRIC_NAME: 'UsersCount',
  USER_EVENTS_COUNT_METRIC_NAME: 'UserEventsCount',
  ACTIVE_RULE_INSTANCES_COUNT_METRIC_NAME: 'ActiveRuleInstancesCount',
  SANCTIONS_SEARCHES_COUNT_METRIC_NAME: 'SanctionsSearchesCount',
  COMPLY_ADVANTAGE_SANCTIONS_SEARCHES_COUNT_METRIC_NAME:
    'ComplyAdvantageSanctionsSearchesCount',
  ACURIS_SANCTIONS_SEARCHES_COUNT_METRIC_NAME: 'KYC6SanctionsSearchesCount',
  OPEN_SANCTIONS_SANCTIONS_SEARCHES_COUNT_METRIC_NAME:
    'OpenSanctionsSanctionsSearchesCount',
  DOW_JONES_SANCTIONS_SEARCHES_COUNT_METRIC_NAME:
    'DowJonesSanctionsSearchesCount',
  USERS_SCREENING_COUNT_METRIC_NAME: 'UsersScreeningCount',
  TRANSACTIONS_SCREENING_COUNT_METRIC_NAME: 'TransactionsScreeningCount',
  TENANT_SEATS_COUNT_METRIC_NAME: 'TenantSeatsCount',
}

export const TRANSACTIONS_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.TRANSACTION_COUNT_METRIC_NAME,
  kind: 'CULMULATIVE',
}

export const SANCTIONS_SEARCHES_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.SANCTIONS_SEARCHES_COUNT_METRIC_NAME,
  kind: 'CULMULATIVE',
}

export const COMPLY_ADVANTAGE_SANCTIONS_SEARCHES_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.COMPLY_ADVANTAGE_SANCTIONS_SEARCHES_COUNT_METRIC_NAME,
  kind: 'CULMULATIVE',
}

export const ACURIS_SANCTIONS_SEARCHES_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.ACURIS_SANCTIONS_SEARCHES_COUNT_METRIC_NAME,
  kind: 'CULMULATIVE',
}

export const OPEN_SANCTIONS_SANCTIONS_SEARCHES_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.OPEN_SANCTIONS_SANCTIONS_SEARCHES_COUNT_METRIC_NAME,
  kind: 'CULMULATIVE',
}

export const DOW_JONES_SANCTIONS_SEARCHES_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.DOW_JONES_SANCTIONS_SEARCHES_COUNT_METRIC_NAME,
  kind: 'CULMULATIVE',
}

export const USERS_SCREENING_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.USERS_SCREENING_COUNT_METRIC_NAME,
  kind: 'CULMULATIVE',
}

export const TRANSACTIONS_SCREENING_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.TRANSACTIONS_SCREENING_COUNT_METRIC_NAME,
  kind: 'CULMULATIVE',
}

export const TENANT_SEATS_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.TENANT_SEATS_COUNT_METRIC_NAME,
  kind: 'GAUGE',
}

export const TRANSACTION_EVENTS_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.TRANSACTION_EVENTS_COUNT_METRIC_NAME,
  kind: 'CULMULATIVE',
}

export const USERS_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.USERS_COUNT_METRIC_NAME,
  kind: 'CULMULATIVE',
}

export const USER_EVENTS_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.USER_EVENTS_COUNT_METRIC_NAME,
  kind: 'CULMULATIVE',
}

export const ACTIVE_RULE_INSTANCES_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.ACTIVE_RULE_INSTANCES_COUNT_METRIC_NAME,
  kind: 'GAUGE',
}

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

import { CUSTOM_API_USAGE_METRIC_NAMES } from './usage-metrics-names'
import { Metric } from '@/@types/cloudwatch'

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

export const CONSUMER_RISK_FACTOR_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.CONSUMER_RISK_FACTOR_COUNT_METRIC_NAME,
  kind: 'CULMULATIVE',
}

export const BUSINESS_RISK_FACTOR_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.BUSINESS_RISK_FACTOR_COUNT_METRIC_NAME,
  kind: 'CULMULATIVE',
}

export const TRANSACTION_RISK_FACTOR_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.TRANSACTION_RISK_FACTOR_COUNT_METRIC_NAME,
  kind: 'CULMULATIVE',
}

export const ALERTS_OPEN_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.ALERTS_OPEN_COUNT_METRIC_NAME,
  kind: 'CULMULATIVE',
}

export const ALERTS_CLOSED_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.ALERTS_CLOSED_COUNT_METRIC_NAME,
  kind: 'CULMULATIVE',
}

export const REPORTS_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.REPORTS_COUNT_METRIC_NAME,
  kind: 'CULMULATIVE',
}

export const SLA_POLICY_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.SLA_POLICY_COUNT_METRIC_NAME,
  kind: 'CULMULATIVE',
}

export const SCREENING_COUNT_METRIC: Metric = {
  namespace: 'flagright/ApiUsageMetrics',
  name: CUSTOM_API_USAGE_METRIC_NAMES.SCREENING_COUNT_METRIC_NAME,
  kind: 'CULMULATIVE',
}

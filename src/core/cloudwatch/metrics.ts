export type Metric = {
  namespace: string
  name: string
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

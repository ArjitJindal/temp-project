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

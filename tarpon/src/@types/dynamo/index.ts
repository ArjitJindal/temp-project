import { ClickhouseTableNames } from '../clickhouse/table-names'

export type dynamoKey = {
  PartitionKeyID: string
  SortKeyID?: string
}

export type dynamoKeyList = {
  key: dynamoKey
}[]

export type dynamoKeyListOptions = {
  keyLists: dynamoKeyList
  tableName: ClickhouseTableNames
}

export interface DynamoConsumerMessage {
  tenantId: string
  tableName: ClickhouseTableNames
  items: dynamoKeyList
}

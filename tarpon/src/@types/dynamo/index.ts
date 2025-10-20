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

export type DynamoConsumerMessage = {
  tenantId: string
  tableName: ClickhouseTableNames
  items: dynamoKeyList
} & (
  | {
      deleteFromClickHouse?: false | undefined
      whereClause?: string
    }
  | {
      deleteFromClickHouse: true
      whereClause: string
    }
)

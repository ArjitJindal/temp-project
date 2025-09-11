export type dynamoKey = {
  PartitionKeyID: string
  SortKeyID?: string
}

export type dynamoKeyList = {
  key: dynamoKey
}[]

export type dynamoKeyListOptions = {
  keyLists: dynamoKeyList
  tableName: string
}

export interface DynamoConsumerMessage {
  tenantId: string
  tableName: string
  items: dynamoKeyList
}

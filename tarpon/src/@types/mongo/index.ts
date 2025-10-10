import { Filter, Document, UpdateFilter } from 'mongodb'
import { ClickhouseTableDefinition } from '../clickhouse'

export type TableDetails = {
  tenantId: string
  collectionName: string
  clickhouseTable: ClickhouseTableDefinition
  mongoCollectionName: string
}
type MongoConsumerFilterDocument = {
  type: 'filter'
  value: Filter<Document>
}
type MongoConsumerIdDocument = {
  type: 'id'
  value: string
}

export type MongoConsumerMessage = {
  operationType: 'delete' | 'insert' | 'update' | 'replace'
  documentKey: MongoConsumerFilterDocument | MongoConsumerIdDocument
  clusterTime: number
  collectionName: string
}

export interface MongoUpdateMessage<T extends Document = Document> {
  filter: Filter<T>
  operationType: 'updateOne'
  updateMessage: UpdateFilter<T>
  sendToClickhouse: boolean
  collectionName: string
  upsert?: boolean
  arrayFilters?: Document[]
}

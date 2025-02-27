import {
  Document,
  MongoClient,
  ObjectId,
  WithId,
  Filter,
  FindCursor,
} from 'mongodb'
import { chunk, Dictionary, groupBy, memoize } from 'lodash'
import pMap from 'p-map'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import {
  batchInsertToClickhouse,
  getClickhouseClient,
} from '@/utils/clickhouse/utils'
import { traceable } from '@/core/xray'
import {
  ClickhouseTableDefinition,
  ClickHouseTables,
  MONGO_COLLECTION_SUFFIX_MAP_TO_CLICKHOUSE,
} from '@/utils/clickhouse/definition'
import { CurrencyService } from '@/services/currency'
import { Transaction } from '@/@types/openapi-internal/Transaction'
import { TransactionAmountDetails } from '@/@types/openapi-internal/TransactionAmountDetails'
import { generateChecksum } from '@/utils/object'
import { TENANT_DELETION_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DeleteTenant } from '@/@types/openapi-internal/DeleteTenant'
import { getDynamoDbClient } from '@/utils/dynamodb'

type TableDetails = {
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
  isDynamoDbTrigger?: boolean
}

export type DynamoUpdateMessage = {
  tenantId: string
  tableName: string
  transactItems: {
    key: {
      PartitionKeyID: string
      SortKeyID?: string
    }
    updateExpression: string
    expressionAttributeValues: Record<string, any>
  }[]
}

@traceable
export class MongoDbConsumer {
  private mongoClient: MongoClient
  private currencyService: CurrencyService

  constructor(mongoClient: MongoClient) {
    this.mongoClient = mongoClient
    this.currencyService = new CurrencyService()
  }

  private findClickhouseTableDefinition = memoize(
    (clickhouseTableName: string): ClickhouseTableDefinition => {
      return ClickHouseTables.find(
        (table) => table.table === clickhouseTableName
      ) as ClickhouseTableDefinition
    }
  )

  private isDynamoDbTrigger(
    events: MongoConsumerMessage[] | DynamoUpdateMessage[]
  ) {
    const dynamoMessages = events.filter((event) => 'tableName' in event)
    const mongoMessages = events.filter((event) => !('tableName' in event))
    return { dynamoMessages, mongoMessages }
  }

  public async handleMongoConsumerMessage(
    events: MongoConsumerMessage[] | DynamoUpdateMessage[]
  ) {
    const { dynamoMessages, mongoMessages } = this.isDynamoDbTrigger(events)
    if (dynamoMessages.length > 0) {
      await this.executeDynamoUpdate(dynamoMessages as DynamoUpdateMessage[])
    }
    const { messagesToReplace, messagesToDelete } = this.segregateMessages(
      mongoMessages as MongoConsumerMessage[]
    )

    await Promise.all([
      this.handleMessagesReplace(messagesToReplace),
      this.handleMessagesDelete(messagesToDelete),
    ])
  }

  private async executeDynamoUpdate(events: DynamoUpdateMessage[]) {
    const dynamoDb = await getDynamoDbClient()
    await Promise.all(
      events.map(async (event) => {
        // Fetch all updated items
        const updatedItems = await Promise.all(
          event.transactItems.map(async (item) => {
            const { Item } = await dynamoDb.send(
              new GetCommand({
                TableName: event.tableName,
                Key: item.key,
              })
            )
            return Item
          })
        )

        const clickhouseTable = 'alerts'
        console.log(
          '########################UPDATED ITEMS',
          JSON.stringify(updatedItems)
        )
        // Process in chunks to avoid overwhelming Clickhouse
        // Update updatedAt timestamp to current time
        // await new Promise(resolve => setTimeout(resolve, 5000))
        const updatedItemsWithTimestamp = updatedItems.map((item) => {
          if (!item) {
            return null
          }
          return {
            ...item,
            updatedAtClickhouse: Date.now(),
          }
        })
        const chunks = chunk(updatedItemsWithTimestamp.filter(Boolean), 1000)
        for (const batch of chunks) {
          await batchInsertToClickhouse(
            event.tenantId,
            clickhouseTable,
            batch as object[]
          )
        }
      })
    )
  }

  public async handleMessagesReplace(
    messagesToReplace: Dictionary<MongoConsumerMessage[]>
  ) {
    return Promise.all(
      Object.entries(messagesToReplace).map(
        async ([collectionName, records]) => {
          const tableDetails = this.fetchTableDetails(collectionName)
          if (!tableDetails) {
            return
          }

          const { tenantId, clickhouseTable, mongoCollectionName } =
            tableDetails

          const isTenantDeleted = await this.isTenantDeleted(tenantId)

          if (isTenantDeleted) {
            return
          }

          const documentsToReplace = await this.fetchDocuments(
            collectionName,
            records
          )
          const updatedDocuments = await this.updateInsertMessages(
            mongoCollectionName,
            documentsToReplace
          )

          await batchInsertToClickhouse(
            tenantId,
            clickhouseTable.table,
            updatedDocuments
          )
        }
      )
    )
  }

  public fetchTableDetails(tableName: string): TableDetails | false {
    const tableSuffix = Object.keys(
      MONGO_COLLECTION_SUFFIX_MAP_TO_CLICKHOUSE
    ).find((key) => tableName.endsWith(key))

    if (!tableSuffix) {
      return false
    }

    const tenantId = tableName.replace(`-${tableSuffix}`, '')
    return {
      tenantId,
      collectionName: tableName,
      clickhouseTable: this.findClickhouseTableDefinition(
        MONGO_COLLECTION_SUFFIX_MAP_TO_CLICKHOUSE[tableSuffix]
      ),
      mongoCollectionName: tableSuffix,
    }
  }

  private async fetchDocuments(
    collectionName: string,
    records: MongoConsumerMessage[],
    onlyId: boolean = false
  ): Promise<WithId<Document>[]> {
    const mongoCollection = this.mongoClient.db().collection(collectionName)
    const filters = this.buildFilters(records)
    const documents: FindCursor<WithId<Document>> = mongoCollection.find({
      $or: filters,
    })

    if (onlyId) {
      documents.project({ _id: 1 })
    }

    return documents.toArray()
  }

  private buildFilters(records: MongoConsumerMessage[]): Filter<Document>[] {
    return records.map((record) => {
      if (record.documentKey.type === 'filter') {
        return record.documentKey.value
      }

      let objectId: ObjectId | string

      try {
        objectId = new ObjectId(record.documentKey.value)
      } catch (error) {
        objectId = record.documentKey.value
      }

      return { _id: objectId as ObjectId }
    })
  }

  public async updateInsertMessages(
    mongoCollectionName: string,
    records: WithId<Document>[]
  ): Promise<WithId<Document>[]> {
    switch (mongoCollectionName) {
      case 'transactions':
        return this.updateTransactionInsertMessages(records)
      default:
        return records
    }
  }

  private DEFAULT_AMOUNT_DETAILS: TransactionAmountDetails = {
    transactionAmount: 0,
    transactionCurrency: 'USD',
  }

  private async updateTransactionInsertMessages(
    records: WithId<Document>[]
  ): Promise<WithId<Document>[]> {
    return await pMap(
      records,
      async (record) => {
        const transaction = record as WithId<Transaction>
        const { originAmountDetails, destinationAmountDetails } = transaction

        const [originAmountInUsd, destinationAmountInUsd] = await Promise.all([
          this.getAmountInUsd(originAmountDetails),
          this.getAmountInUsd(destinationAmountDetails),
        ])

        return {
          ...transaction,
          originAmountDetails: {
            ...originAmountDetails,
            amountInUsd: originAmountInUsd.transactionAmount,
          },
          destinationAmountDetails: {
            ...destinationAmountDetails,
            amountInUsd: destinationAmountInUsd.transactionAmount,
          },
        }
      },
      { concurrency: 100 }
    )
  }

  private async getAmountInUsd(
    amountDetails?: TransactionAmountDetails
  ): Promise<TransactionAmountDetails> {
    if (!amountDetails) {
      return this.DEFAULT_AMOUNT_DETAILS
    }
    return this.currencyService.getTargetCurrencyAmount(amountDetails, 'USD')
  }

  private async executeDeleteQuery(
    tenantId: string,
    tableName: string,
    filterConditions: string
  ) {
    const query = `ALTER TABLE ${tableName} UPDATE is_deleted = 1 WHERE ${filterConditions}`
    const client = await getClickhouseClient(tenantId)
    await client.query({ query })
  }

  public segregateMessages(records: MongoConsumerMessage[]): {
    messagesToDelete: Dictionary<MongoConsumerMessage[]>
    messagesToReplace: Dictionary<MongoConsumerMessage[]>
  } {
    const messagesToDelete: Record<string, MongoConsumerMessage> = {}
    const messagesToReplace: Record<string, MongoConsumerMessage> = {}

    for (const record of records) {
      const { operationType, documentKey, clusterTime, collectionName } = record
      const key = this.getUniqueKey(collectionName, documentKey)

      if (operationType === 'delete') {
        const deleteRecord = record

        if (
          !messagesToReplace[key] ||
          (messagesToReplace[key]?.clusterTime ?? 0) < clusterTime
        ) {
          delete messagesToReplace[key]
          messagesToDelete[key] = deleteRecord
        }
      } else if (['insert', 'update', 'replace'].includes(operationType)) {
        const replaceRecord = record

        if (
          !messagesToDelete[key] ||
          (messagesToDelete[key]?.clusterTime ?? 0) < clusterTime
        ) {
          delete messagesToDelete[key]
          messagesToReplace[key] = replaceRecord
        }
      }
    }

    const messagesToDeleteArray = groupBy(
      Object.values(messagesToDelete),
      'collectionName'
    )
    const messagesToReplaceArray = groupBy(
      Object.values(messagesToReplace),
      'collectionName'
    )

    return {
      messagesToDelete: messagesToDeleteArray,
      messagesToReplace: messagesToReplaceArray,
    }
  }

  private async handleMessagesDelete(
    messagesToDelete: Dictionary<MongoConsumerMessage[]>
  ) {
    return Promise.all(
      Object.entries(messagesToDelete).map(
        async ([collectionName, records]) => {
          const tableDetails = this.fetchTableDetails(collectionName)
          if (!tableDetails) {
            return
          }

          const { clickhouseTable, tenantId } = tableDetails

          const isTenantDeleted = await this.isTenantDeleted(tenantId)
          if (isTenantDeleted) {
            return
          }

          const items = await this.fetchDocuments(collectionName, records)
          const filterConditions = `mongo_id IN (${items
            .map((item) => `'${item._id}'`)
            .join(',')})`

          await this.executeDeleteQuery(
            tenantId,
            clickhouseTable.table,
            filterConditions
          )
        }
      )
    )
  }

  private async isTenantDeleted(tenantId: string) {
    const deletedTenants = await this.deletedTenants()
    return deletedTenants.some((tenant) => tenant.tenantId === tenantId)
  }

  private deletedTenants = memoize(async () => {
    const mongoDb = await getMongoDbClient()
    const collection = mongoDb
      .db()
      .collection<Pick<DeleteTenant, 'tenantId'>>(TENANT_DELETION_COLLECTION)
    const tenants = collection
      .find({
        latestStatus: {
          $in: ['IN_PROGRESS', 'WAITING_HARD_DELETE', 'HARD_DELETED'],
        },
      })
      .project({ tenantId: 1 })

    return tenants.toArray()
  })

  private getUniqueKey(
    collectionName: string,
    documentKey: { _id: string } | Filter<Document>
  ): string {
    if ('_id' in documentKey) {
      return generateChecksum(documentKey._id, 20)
    }
    return generateChecksum(
      `${collectionName}:${JSON.stringify(documentKey)}`,
      20
    )
  }

  async handleMongoConsumerSQSMessage(events: MongoConsumerMessage[]) {
    const { messagesToReplace, messagesToDelete } =
      this.segregateMessages(events)

    await Promise.all([
      this.handleMessagesReplace(messagesToReplace),
      this.handleMessagesDelete(messagesToDelete),
    ])
  }
}

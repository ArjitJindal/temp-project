import { Document, MongoClient, ObjectId, WithId } from 'mongodb'
import { Dictionary, groupBy, memoize } from 'lodash'
import { ClickHouseClient } from '@clickhouse/client'
import { MongoConsumerSQSMessage } from './app'
import {
  batchInsertToClickhouse,
  sanitizeTableName,
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

type TableDetails = {
  tenantId: string
  collectionName: string
  clickhouseTable: ClickhouseTableDefinition
  mongoCollectionName: string
}

@traceable
export class MongoDbConsumer {
  mongoClient: MongoClient
  clickhouseClient: ClickHouseClient

  constructor(mongoClient: MongoClient, clickhouseClient: ClickHouseClient) {
    this.mongoClient = mongoClient
    this.clickhouseClient = clickhouseClient
  }

  private findClickhouseTableDefinition = memoize(
    (clickhouseTableName: string): ClickhouseTableDefinition => {
      return ClickHouseTables.find(
        (table) => table.table === clickhouseTableName
      ) as ClickhouseTableDefinition
    }
  )

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

  async handleMessagesReplace(
    mongoClient: MongoClient,
    messagesToReplace: Dictionary<MongoConsumerSQSMessage[]>
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

          const mongoCollection = mongoClient.db().collection(collectionName)
          const _ids = records.map((doc) => new ObjectId(doc.documentKey._id))
          const documents = mongoCollection.find({ _id: { $in: _ids } })
          const documentsToReplace = await documents.toArray()

          const updatedDocuments = await this.updateInsertMessages(
            mongoCollectionName,
            documentsToReplace
          )

          await batchInsertToClickhouse(
            sanitizeTableName(`${tenantId}-${clickhouseTable.table}`),
            updatedDocuments,
            tenantId
          )
        }
      )
    )
  }

  private async updateTransactionInsertMessages(
    records: WithId<Document>[]
  ): Promise<WithId<Document>[]> {
    const currencyService = new CurrencyService()

    const DEFAULT_AMOUNT_DETAILS: TransactionAmountDetails = {
      transactionAmount: 0,
      transactionCurrency: 'USD',
    }

    const updatedRecords = await Promise.all(
      records.map(async (record) => {
        const transaction = record as WithId<Transaction>
        const originAmountDetails = transaction.originAmountDetails
        const destinationAmountDetails = transaction.destinationAmountDetails

        const [
          originTransactionAmountInUsd,
          destinationTransactionAmountInUsd,
        ] = await Promise.all([
          originAmountDetails
            ? currencyService.getTargetCurrencyAmount(
                originAmountDetails,
                'USD'
              )
            : DEFAULT_AMOUNT_DETAILS,
          destinationAmountDetails
            ? currencyService.getTargetCurrencyAmount(
                destinationAmountDetails,
                'USD'
              )
            : DEFAULT_AMOUNT_DETAILS,
        ])

        return {
          ...transaction,
          originAmountDetails: {
            ...originAmountDetails,
            amountInUsd: originTransactionAmountInUsd.transactionAmount,
          },
          destinationAmountDetails: {
            ...destinationAmountDetails,
            amountInUsd: destinationTransactionAmountInUsd,
          },
        }
      })
    )

    return updatedRecords
  }

  public async updateInsertMessages(
    monngoCollectionName: string,
    records: WithId<Document>[]
  ): Promise<WithId<Document>[]> {
    switch (monngoCollectionName) {
      case 'transactions': {
        return await this.updateTransactionInsertMessages(records)
      }
      default: {
        return records
      }
    }
  }

  public segregateMessages(records: MongoConsumerSQSMessage[]): {
    messagesToDelete: Dictionary<MongoConsumerSQSMessage[]>
    messagesToReplace: Dictionary<MongoConsumerSQSMessage[]>
  } {
    const messagesToDelete: Record<string, MongoConsumerSQSMessage> = {}
    const messagesToReplace: Record<string, MongoConsumerSQSMessage> = {}

    for (const record of records) {
      const { operationType, documentKey, clusterTime } = record
      const { _id } = documentKey

      if (operationType === 'delete') {
        const deleteRecord = record

        if (
          !messagesToReplace[_id] ||
          (messagesToReplace[_id]?.clusterTime ?? 0) < clusterTime
        ) {
          delete messagesToReplace[_id]
          messagesToDelete[_id] = deleteRecord
        }
      } else if (['insert', 'update', 'replace'].includes(operationType)) {
        const replaceRecord = record

        if (
          !messagesToDelete[_id] ||
          (messagesToDelete[_id]?.clusterTime ?? 0) < clusterTime
        ) {
          delete messagesToDelete[_id]
          messagesToReplace[_id] = replaceRecord
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

  async handleMessagesDelete(
    messagesToDelete: Dictionary<MongoConsumerSQSMessage[]>
  ) {
    return Promise.all(
      Object.entries(messagesToDelete).map(
        async ([collectionName, records]) => {
          const tableDetails = this.fetchTableDetails(collectionName)
          if (!tableDetails) {
            return
          }

          const { tenantId, clickhouseTable } = tableDetails
          const tableName = sanitizeTableName(
            `${tenantId}-${clickhouseTable.table}`
          )

          const query = `ALTER TABLE ${tableName} UPDATE is_deleted = 1 WHERE mongo_id IN (${records
            .map((doc) => `'${doc.documentKey._id}'`)
            .join(', ')})`

          await this.clickhouseClient.query({
            query,
          })
        }
      )
    )
  }

  async handleMongoConsumerSQSMessage(events: MongoConsumerSQSMessage[]) {
    const { messagesToReplace, messagesToDelete } =
      this.segregateMessages(events)

    await Promise.all([
      this.handleMessagesReplace(this.mongoClient, messagesToReplace),
      this.handleMessagesDelete(messagesToDelete),
    ])
  }
}

import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '../utils/migration-progress'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TRANSACTION_EVENTS_COLLECTION } from '@/utils/mongodb-definitions'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'

export const up = async () => {
  const tenantId = process.env.ENV?.startsWith('prod')
    ? 'VOLX1IP7NN'
    : 'flagright'
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()

  const transactionRepository = new TransactionEventRepository(tenantId, {
    dynamoDb,
    mongoDb,
  })
  const transactionEventsCollectionName =
    TRANSACTION_EVENTS_COLLECTION(tenantId)
  const db = mongoDb.db()
  const migrationKey = `2023.08.29T12.58.27.migrate-device-data-in-tranactions-event-${tenantId}`
  const lastCompletedTimestamp = await getMigrationLastCompletedTimestamp(
    migrationKey
  )
  const transactionEventsCollection = db.collection<TransactionEvent>(
    transactionEventsCollectionName
  )
  const indexExists = await transactionEventsCollection.indexExists(
    'updatedTransactionAttributes.deviceData_1'
  )
  if (!indexExists) {
    await transactionEventsCollection.createIndex({
      'updatedTransactionAttributes.deviceData': 1,
    })
  }
  const cursor = transactionEventsCollection
    .find({
      timestamp: { $gt: lastCompletedTimestamp ?? 0 },
      'updatedTransactionAttributes.deviceData': { $exists: true },
    })
    .sort({
      timestamp: 1,
    })

  for await (const transaction of cursor) {
    const deviceData = transaction?.updatedTransactionAttributes?.deviceData
    delete (transaction as any)._id
    await Promise.all([
      transactionRepository.saveTransactionEvent({
        ...transaction,
        updatedTransactionAttributes: {
          ...transaction.updatedTransactionAttributes,
          originDeviceData: deviceData,
          deviceData: undefined,
        },
      }),
      updateMigrationLastCompletedTimestamp(
        migrationKey,
        transaction.timestamp
      ),
    ])
  }

  if (indexExists) {
    await transactionEventsCollection.dropIndex(
      'updatedTransactionAttributes.deviceData_1'
    )
  }
}
export const down = async () => {
  // skip
}

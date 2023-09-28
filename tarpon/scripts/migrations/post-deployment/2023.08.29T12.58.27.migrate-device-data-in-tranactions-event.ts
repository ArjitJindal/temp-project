import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '../utils/migration-progress'
import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TRANSACTION_EVENTS_COLLECTION } from '@/utils/mongodb-definitions'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { Tenant } from '@/services/accounts'
import { DeviceData } from '@/@types/openapi-internal/DeviceData'

const eligibleTenantId = process.env.ENV?.startsWith('prod')
  ? 'VOLX1IP7NN'
  : 'flagright'

export const migrateTenant = async (tenant: Tenant) => {
  if (tenant.id !== eligibleTenantId) {
    return
  }
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const tenantId = tenant.id
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
    const deviceData = (transaction?.updatedTransactionAttributes as any)
      .deviceData as DeviceData

    delete (transaction as any)._id
    await Promise.all([
      transactionRepository.saveTransactionEvent({
        ...transaction,
        updatedTransactionAttributes: {
          ...transaction.updatedTransactionAttributes,
          originDeviceData: deviceData,
          deviceData: undefined,
        } as any,
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

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

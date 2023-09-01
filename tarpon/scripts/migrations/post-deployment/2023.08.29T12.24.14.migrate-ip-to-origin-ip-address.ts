import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '../utils/migration-progress'
import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { Tenant } from '@/services/accounts'
import { pickKnownEntityFields } from '@/utils/object'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

const elgibleTenantId = process.env.ENV?.startsWith('prod')
  ? 'VOLX1IP7NN'
  : 'flagright'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id !== elgibleTenantId) {
    return
  }
  const tenantId = tenant.id
  const dynamoDb = getDynamoDbClient()
  const transactionRepository = new DynamoDbTransactionRepository(
    tenantId,
    dynamoDb
  )
  const mongoDb = await getMongoDbClient()
  const transactionsCollectionName = TRANSACTIONS_COLLECTION(tenantId)
  const db = mongoDb.db()
  const migrationKey = `migrate-ip-to-origin-ip-address-${tenantId}`
  const lastCompletedTimestamp = await getMigrationLastCompletedTimestamp(
    migrationKey
  )
  const transactionsCollection = db.collection<InternalTransaction>(
    transactionsCollectionName
  )
  const indexExists = await transactionsCollection.indexExists('deviceData_1')
  if (!indexExists) {
    await transactionsCollection.createIndex({
      deviceData: 1,
    })
  }
  const cursor = transactionsCollection
    .find({
      timestamp: { $gt: lastCompletedTimestamp ?? 0 },
      deviceData: { $exists: true },
    })
    .sort({
      timestamp: 1,
    })

  for await (const transaction of cursor) {
    const updatedTransaction = {
      ...pickKnownEntityFields(
        transaction as TransactionWithRulesResult,
        TransactionWithRulesResult
      ),
      originDeviceData: transaction.deviceData,
      deviceData: undefined,
    }
    await Promise.all([
      transactionRepository.saveTransaction(updatedTransaction),
      updateMigrationLastCompletedTimestamp(
        migrationKey,
        transaction.timestamp
      ),
    ])
  }

  if (indexExists) {
    await transactionsCollection.dropIndex('deviceData_1')
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

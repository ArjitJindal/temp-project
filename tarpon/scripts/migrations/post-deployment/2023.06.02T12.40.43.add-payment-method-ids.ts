import { AnyBulkWriteOperation } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import { syncMongoDbIndices } from '../always-run/sync-mongodb-indices'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { getPaymentMethodId } from '@/core/dynamodb/dynamodb-keys'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const transactionsCollection = db.collection<InternalTransaction>(
    TRANSACTIONS_COLLECTION(tenant.id)
  )

  const totalTransactions = await transactionsCollection.count({
    $and: [
      {
        originPaymentMethodId: { $exists: false },
      },
      {
        destinationPaymentMethodId: { $exists: false },
      },
    ],
  })

  console.log(
    `Found ${totalTransactions} transactions without payment method ids`
  )

  const batchSize = 1000
  const totalBatches = Math.ceil(totalTransactions / batchSize)
  let processedCount = 0

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const transactions = await transactionsCollection
      .find({
        $and: [
          {
            originPaymentMethodId: { $exists: false },
          },
          {
            destinationPaymentMethodId: { $exists: false },
          },
        ],
      })
      .skip(batchIndex * batchSize)
      .limit(batchSize)
      .toArray()

    const operations = transactions.map(
      (t): AnyBulkWriteOperation<InternalTransaction> => {
        return {
          replaceOne: {
            filter: { _id: t._id },
            replacement: {
              ...t,
              originPaymentMethodId: getPaymentMethodId(t.originPaymentDetails),
              destinationPaymentMethodId: getPaymentMethodId(
                t.destinationPaymentDetails
              ),
            },
            upsert: true,
          },
        }
      }
    )

    if (operations.length > 0) {
      await transactionsCollection.bulkWrite(operations)
    }
    processedCount += transactions.length
    console.log(
      `Processed ${processedCount} of ${totalTransactions} transactions`
    )
  }
}

export const up = async () => {
  // Sync indices to that filtered query is efficient
  await syncMongoDbIndices()
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

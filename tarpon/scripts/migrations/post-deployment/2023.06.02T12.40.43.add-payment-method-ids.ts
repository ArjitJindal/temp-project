import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient, TRANSACTIONS_COLLECTION } from '@/utils/mongoDBUtils'
import { getPaymentMethodId } from '@/core/dynamodb/dynamodb-keys'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const transactionsCollection = db.collection<InternalTransaction>(
    TRANSACTIONS_COLLECTION(tenant.id)
  )

  const transactions = await transactionsCollection.find({
    originPaymentMethodId: { $exists: false },
  })

  console.log(
    `Found ${await transactions.count()} transactions without payment method ids`
  )

  for await (const t of transactions) {
    const originPaymentMethodId = getPaymentMethodId(t.originPaymentDetails)
    const destinationPaymentMethodId = getPaymentMethodId(
      t.destinationPaymentDetails
    )

    await transactionsCollection.replaceOne(
      {
        _id: t._id,
      },
      {
        ...t,
        originPaymentMethodId,
        destinationPaymentMethodId,
      },
      { upsert: true }
    )

    console.log(`Updated transaction ${t._id} with payment method ids`)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient, TRANSACTIONS_COLLECTION } from '@/utils/mongoDBUtils'
import { getPaymentMethodId } from '@/core/dynamodb/dynamodb-keys'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const transactions = db.collection<InternalTransaction>(
    TRANSACTIONS_COLLECTION(tenant.id)
  )

  for await (const t of transactions.find()) {
    const originPaymentMethodId = getPaymentMethodId(t.originPaymentDetails)
    const destinationPaymentMethodId = getPaymentMethodId(
      t.destinationPaymentDetails
    )

    await transactions.replaceOne(
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
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

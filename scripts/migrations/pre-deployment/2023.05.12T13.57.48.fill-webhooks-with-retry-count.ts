import { migrateAllTenants } from '../utils/tenant'
import { WEBHOOK_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const webhooksCollectionName = WEBHOOK_COLLECTION(tenant.id)
  const webhooksCollection = db.collection(webhooksCollectionName)

  const webhooks = await webhooksCollection.updateMany(
    { retryCount: { $exists: false } },
    { $set: { retryCount: 0 } }
  )

  console.log(
    `Updated ${webhooks.modifiedCount} webhooks for tenant ${tenant.id}`
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

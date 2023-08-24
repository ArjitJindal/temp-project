import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { WEBHOOK_COLLECTION } from '@/utils/mongodb-definitions'
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

import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  const { id: tenantId } = tenant
  const mongodb = await getMongoDbClient()
  const usersCollection = mongodb.db().collection(USERS_COLLECTION(tenantId))
  await usersCollection.updateMany({}, [
    { $set: { updatedAt: '$createdTimestamp' } },
  ])
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

import { migrateAllTenants } from '../utils/tenant'
import { USERS_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'

async function migrateTenant(tenant: Tenant) {
  const mongodb = await getMongoDbClient()
  const usersCollection = mongodb.db().collection(USERS_COLLECTION(tenant.id))
  const { deletedCount } = await usersCollection.deleteMany({
    userId: { $eq: null },
  })
  console.log(`Deleted ${deletedCount} user documents without userId`)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

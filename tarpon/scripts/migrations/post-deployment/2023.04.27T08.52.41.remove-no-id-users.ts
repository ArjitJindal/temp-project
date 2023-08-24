import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'
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

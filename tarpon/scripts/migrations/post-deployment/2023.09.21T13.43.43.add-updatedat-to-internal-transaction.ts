import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  const { id: tenantId } = tenant
  const mongodb = await getMongoDbClient()
  const transactionsCollection = mongodb
    .db()
    .collection(TRANSACTIONS_COLLECTION(tenantId))
  await transactionsCollection.updateMany({}, [
    { $set: { updatedAt: '$timestamp' } },
  ])
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

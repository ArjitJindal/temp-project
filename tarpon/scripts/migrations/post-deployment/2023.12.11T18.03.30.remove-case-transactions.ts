import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const collectionName = CASES_COLLECTION(tenant.id)
  const db = mongoDb.db()
  const collection = db.collection(collectionName)

  await collection.updateMany({}, { $unset: { caseTransactions: '' } })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/@types/tenant'
import { CASES_COLLECTION } from '@/utils/mongo-table-names'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const casesCollection = db.collection(CASES_COLLECTION(tenant.id))
  await casesCollection.deleteMany({ caseId: null })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

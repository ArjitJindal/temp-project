import { migrateAllTenants } from '../utils/tenant'
import { CASES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { Case } from '@/@types/openapi-internal/Case'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const casesCollectionName = CASES_COLLECTION(tenant.id)
  const db = mongoDb.db()
  const casesCollection = db.collection<Case>(casesCollectionName)

  await casesCollection.updateMany(
    { caseType: { $exists: false } },
    {
      $set: { caseType: 'SYSTEM' },
    }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

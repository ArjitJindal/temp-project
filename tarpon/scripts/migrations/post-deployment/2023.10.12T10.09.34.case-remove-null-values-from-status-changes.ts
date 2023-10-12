import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { Case } from '@/@types/openapi-internal/Case'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id !== 'flagright' || process.env.ENV !== 'sandbox') return
  const db = (await getMongoDbClient()).db()
  const casesCollections = db.collection<Case>(CASES_COLLECTION(tenant.id))
  await casesCollections.updateMany(
    { 'statusChanges.caseStatus': null as any },
    { $pull: { statusChanges: null as any } }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

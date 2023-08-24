import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { Tenant } from '@/services/accounts'
import { Case } from '@/@types/openapi-internal/Case'

async function migrateTenant(tenant: Tenant) {
  const db = (await getMongoDbClient()).db()
  const casesCollections = db.collection<Case>(CASES_COLLECTION(tenant.id))
  await casesCollections.updateMany(
    {
      'caseUsers.origin.SortKeyID': { $exists: true },
      'caseUsers.origin.userId': { $eq: null },
      'caseUsers.destination.userId': { $ne: null },
    },
    { $set: { 'caseUsers.origin': null } }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

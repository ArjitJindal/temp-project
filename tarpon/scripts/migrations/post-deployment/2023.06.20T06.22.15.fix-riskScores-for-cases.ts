import { migrateAllTenants } from '../utils/tenant'
import { CASES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { Case } from '@/@types/openapi-internal/Case'

async function migrateTenant(tenant: Tenant) {
  const db = (await getMongoDbClient()).db()
  const casesCollections = db.collection<Case>(CASES_COLLECTION(tenant.id))
  await casesCollections.updateMany(
    { 'caseUsers.destination': { $eq: null } },
    {
      $set: {
        'caseUsers.destinationUserDrsScore': null,
      },
    }
  )

  await casesCollections.updateMany(
    { 'caseUsers.origin': { $eq: null } },
    {
      $set: {
        'caseUsers.originUserDrsScore': null,
      },
    }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

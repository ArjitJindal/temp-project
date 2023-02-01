import { StackConstants } from '@cdk/constants'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/@types/openapi-internal/Tenant'
import { CASES_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'

import { Case } from '@/@types/openapi-internal/Case'

export async function migrateTenant(tenant: Tenant) {
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)

  const db = mongodb.db()
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenant.id))
  await casesCollection.deleteMany({ caseType: 'TRANSACTION' })
  console.log(`Deleted Stale transaction Cases`)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skipping
}

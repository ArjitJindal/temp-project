import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts/repository'
import { NARRATIVE_TEMPLATE_COLLECTION } from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const dbExists = await mongoDb
    .db()
    .listCollections({ name: tenant.id })
    .toArray()

  if (dbExists.length === 0) {
    return
  }

  const mongoDbCollection1 = mongoDb
    .db(tenant.id)
    .collection(NARRATIVE_TEMPLATE_COLLECTION(tenant.id))

  const narrativeTemplates = await mongoDbCollection1.find({}).toArray()

  const mongoDbCollection2 = mongoDb
    .db()
    .collection(NARRATIVE_TEMPLATE_COLLECTION(tenant.id))

  await mongoDbCollection2.insertMany(narrativeTemplates)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

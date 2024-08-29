import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { INVESTIGATION_COLLECTION } from '@/utils/mongodb-definitions'
import { Investigation } from '@/services/copilot/questions/types'

async function migrateTenant(tenant: Tenant) {
  const mongoClient = await getMongoDbClient()
  const db = mongoClient.db()
  await db
    .collection<Investigation>(INVESTIGATION_COLLECTION(tenant.id))
    .deleteMany({
      'questions.createdById': 'auth0|63ebb6573e9ee33a6806e3e1', // tim@flagright.com
    })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

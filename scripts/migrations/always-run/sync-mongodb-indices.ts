import { StackConstants } from '@cdk/constants'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/lambdas/phytoplankton-internal-api-handlers/services/accounts-service'
import { createMongoDBCollections } from '@/lambdas/api-key-generator/app'
import { getMongoDbClient } from '@/utils/mongoDBUtils'

async function migrateTenant(tenant: Tenant) {
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)
  await createMongoDBCollections(mongodb, tenant.id)
  console.info(`MongoDB indices synced for tenant: ${tenant.id}`)
}

export async function syncMongoDbIndices() {
  await migrateAllTenants(migrateTenant)
}

if (require.main === module) {
  syncMongoDbIndices()
}

import { StackConstants } from '@cdk/constants'
import { getMongoDbClient } from './utils/db'
import { migrateAllTenants } from './utils/tenant'
import { Tenant } from '@/lambdas/phytoplankton-internal-api-handlers/services/accounts-service'
import { createMongoDBCollections } from '@/lambdas/api-key-generator/app'

async function migrateTenant(tenant: Tenant) {
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)
  await createMongoDBCollections(mongodb, tenant.id)
  console.info(`MongoDB indices synced for tenant: ${tenant.id}`)
}

migrateAllTenants(migrateTenant)

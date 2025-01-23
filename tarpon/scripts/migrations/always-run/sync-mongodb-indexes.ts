import { migrateAllTenants } from '../utils/tenant'
import { logger } from '@/core/logger'
import { Tenant } from '@/services/accounts/repository'
import {
  createMongoDBCollections,
  getMongoDbClient,
  createGlobalMongoDBCollections,
} from '@/utils/mongodb-utils'

async function migrateTenant(tenant: Tenant) {
  const mongodb = await getMongoDbClient()
  await createMongoDBCollections(mongodb, tenant.id)
  console.info(`MongoDB indexes synced for tenant: ${tenant.id}`)
}

export async function syncMongoDbIndexes() {
  await migrateAllTenants(migrateTenant)
  const mongodb = await getMongoDbClient()
  await createGlobalMongoDBCollections(mongodb)
}

if (require.main === module) {
  void syncMongoDbIndexes()
    .then(() => process.exit(0))
    .catch((e) => {
      logger.error(e)
      process.exit(1)
    })
}

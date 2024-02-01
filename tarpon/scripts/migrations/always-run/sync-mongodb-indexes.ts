import { migrateAllTenants } from '../utils/tenant'
import { logger } from '@/core/logger'
import { Tenant } from '@/services/accounts'
import {
  createMongoDBCollections,
  getMongoDbClient,
} from '@/utils/mongodb-utils'

async function migrateTenant(tenant: Tenant) {
  const mongodb = await getMongoDbClient()
  await createMongoDBCollections(mongodb, tenant.id)
  console.info(`MongoDB indexes synced for tenant: ${tenant.id}`)
}

export async function syncMongoDbIndexes() {
  await migrateAllTenants(migrateTenant)
}

if (require.main === module) {
  void syncMongoDbIndexes()
    .then(() => process.exit(0))
    .catch((e) => {
      logger.error(e)
      process.exit(1)
    })
}

import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import {
  createMongoDBCollections,
  getMongoDbClient,
} from '@/utils/mongodb-utils'

async function migrateTenant(tenant: Tenant) {
  const mongodb = await getMongoDbClient()
  await createMongoDBCollections(mongodb, tenant.id)
  console.info(`MongoDB indices synced for tenant: ${tenant.id}`)
}

export async function syncMongoDbIndices() {
  await migrateAllTenants(migrateTenant)
}

if (require.main === module) {
  void syncMongoDbIndices()
}

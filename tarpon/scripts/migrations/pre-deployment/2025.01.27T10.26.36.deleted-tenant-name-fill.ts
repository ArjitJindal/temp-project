import { migrateAllTenants } from '../utils/tenant'
import {
  sandboxTenants,
  productionTenants,
} from '../utils/previous-deleted-tenant-names'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts/repository'
import { TENANT_DELETION_COLLECTION } from '@/utils/mongodb-definitions'
import { envIs } from '@/utils/env'

async function migrateTenant(tenant: Tenant) {
  if (!envIs('sandbox') && !envIs('prod')) {
    return
  }

  const mongoDb = await getMongoDbClientDb()
  const deletedTenantCollection = mongoDb.collection(TENANT_DELETION_COLLECTION)
  const deletedTenant = await deletedTenantCollection.findOne({
    tenantId: tenant.id,
  })
  if (!deletedTenant) {
    return
  }
  if (envIs('sandbox')) {
    if (tenant.id in sandboxTenants) {
      await deletedTenantCollection.updateOne(
        { tenantId: tenant.id },
        { $set: { tenantName: sandboxTenants[tenant.id] } }
      )
    }
  } else {
    if (tenant.id in productionTenants) {
      await deletedTenantCollection.updateOne(
        { tenantId: tenant.id },
        { $set: { tenantName: productionTenants[tenant.id] } }
      )
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

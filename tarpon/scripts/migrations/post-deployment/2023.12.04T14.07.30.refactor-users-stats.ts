import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'

async function migrateTenant(tenant: Tenant) {
  const db = (await getMongoDbClient()).db()

  // Delete the old unused collections
  for (const collectionName of [
    `${tenant.id}-dashboard-users-stats-hourly`,
    `${tenant.id}-dashboard-users-stats-daily`,
    `${tenant.id}-dashboard-users-stats-monthly`,
    `${tenant.id}-drs-scores-distribution`,
    `${tenant.id}-kyc-status-distribution`,
  ]) {
    try {
      await db.dropCollection(collectionName)
    } catch (e) {
      // ignore
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

import { migrateAllTenants } from '../utils/tenant'
import { tenantHasFeature } from '@/core/utils/context'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DashboardStatsRepository } from '@/services/dashboard/repositories/dashboard-stats-repository'

async function migrateTenant(tenant: Tenant) {
  if (await tenantHasFeature(tenant.id, 'QA')) {
    const mongoDb = await getMongoDbClient()
    const dashboardStatsRepository = new DashboardStatsRepository(tenant.id, {
      mongoDb,
    })
    await dashboardStatsRepository.recalculateQaAlertsStatsByChecklistReason()
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

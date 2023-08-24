import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const dashboardStatsRepository = new DashboardStatsRepository(tenant.id, {
    mongoDb,
  })
  await dashboardStatsRepository.refreshTeamStats()
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id !== 'flagright') {
    return
  }
  const mongoDb = await getMongoDbClient()
  const dashboardRepository = new DashboardStatsRepository(tenant.id, {
    mongoDb,
  })

  await dashboardRepository.refreshUserStats()
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

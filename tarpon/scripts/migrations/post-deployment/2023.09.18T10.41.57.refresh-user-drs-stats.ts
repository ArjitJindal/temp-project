import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'
import { DashboardStatsDRSDistributionData } from '@/@types/openapi-internal/DashboardStatsDRSDistributionData'
import { DRS_SCORES_DISTRIBUTION_STATS_COLLECTION } from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const collection = db.collection<{
    _id: string
    business: DashboardStatsDRSDistributionData[]
    consumer: DashboardStatsDRSDistributionData[]
  }>(DRS_SCORES_DISTRIBUTION_STATS_COLLECTION(tenant.id))
  await collection.deleteMany({})
  const dashboardStatsRepository = new DashboardStatsRepository(tenant.id, {
    mongoDb,
  })
  await dashboardStatsRepository.refreshUserStats()
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

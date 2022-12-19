import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/lambdas/console-api-account/services/accounts-service'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'
import {
  DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY,
  DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY,
  getMongoDbClient,
} from '@/utils/mongoDBUtils'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const dashboardStatsRepository = new DashboardStatsRepository(tenant.id, {
    mongoDb,
  })
  await db
    .collection(DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(tenant.id))
    .deleteMany({})
  await db
    .collection(DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(tenant.id))
    .deleteMany({})
  await dashboardStatsRepository.refreshCaseStats()
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

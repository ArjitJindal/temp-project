import { migrateAllTenants } from '../utils/tenant'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'
import { Tenant } from '@/services/accounts'
import {
  DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY,
  DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY,
  DASHBOARD_TEAM_ALERTS_STATS_HOURLY,
  DASHBOARD_TEAM_CASES_STATS_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY,
  DRS_SCORES_DISTRIBUTION_STATS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const dashboardCollections = [
    DASHBOARD_TEAM_CASES_STATS_HOURLY(tenant.id),
    DASHBOARD_TEAM_ALERTS_STATS_HOURLY(tenant.id),
    DRS_SCORES_DISTRIBUTION_STATS_COLLECTION(tenant.id),
    DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(tenant.id),
    DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(tenant.id),
    DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(tenant.id),
    DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY(tenant.id),
    DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY(tenant.id),
  ]

  for (const collection of dashboardCollections) {
    await db
      .collection(collection)
      .updateMany({ updatedAt: { $exists: false } }, { $set: { updatedAt: 0 } })
  }

  const dashboardStatsRepository = new DashboardStatsRepository(tenant.id, {
    mongoDb,
  })
  await dashboardStatsRepository.refreshAllStats()
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

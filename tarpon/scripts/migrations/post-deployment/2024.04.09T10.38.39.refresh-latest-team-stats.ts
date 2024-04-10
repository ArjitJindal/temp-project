import { migrateAllTenants } from '../utils/tenant'
import {
  DASHBOARD_LATEST_TEAM_ALERTS_STATS_HOURLY,
  DASHBOARD_LATEST_TEAM_CASES_STATS_HOURLY,
} from '@/utils/mongodb-definitions'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'

async function migrateTenant(tenant: Tenant) {
  const dashboardLatestTeamStatsAlertsCollection =
    DASHBOARD_LATEST_TEAM_ALERTS_STATS_HOURLY(tenant.id)
  const dashboardLatestTeamStatsCasesCollection =
    DASHBOARD_LATEST_TEAM_CASES_STATS_HOURLY(tenant.id)

  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()

  // drop all indexes

  try {
    await db.collection(dashboardLatestTeamStatsAlertsCollection).dropIndexes()
  } catch {
    // ignore
  }
  try {
    await db.collection(dashboardLatestTeamStatsCasesCollection).dropIndexes()
  } catch {
    // ignore
  }

  // clear everything from the collections
  await db.collection(dashboardLatestTeamStatsAlertsCollection).deleteMany({})
  await db.collection(dashboardLatestTeamStatsCasesCollection).deleteMany({})

  const dashboardStatsRepository = new DashboardStatsRepository(tenant.id, {
    mongoDb,
  })

  // rebuild the latest team stats
  await dashboardStatsRepository.refreshLatestTeamStats()
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

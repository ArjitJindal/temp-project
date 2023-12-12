import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import {
  DASHBOARD_LATEST_TEAM_ALERTS_STATS_HOURLY,
  DASHBOARD_LATEST_TEAM_CASES_STATS_HOURLY,
} from '@/utils/mongodb-definitions'
import { LatestTeamStatsDashboardMetric } from '@/lambdas/console-api-dashboard/repositories/dashboard-metrics/latest-team-stats'

async function migrateTenant(tenant: Tenant) {
  const db = await getMongoDbClientDb()
  const latestCasesCollection = db.collection(
    DASHBOARD_LATEST_TEAM_CASES_STATS_HOURLY(tenant.id)
  )
  const latestAlertsCollection = db.collection(
    DASHBOARD_LATEST_TEAM_ALERTS_STATS_HOURLY(tenant.id)
  )

  await Promise.all([
    latestCasesCollection.deleteMany({}),
    latestAlertsCollection.deleteMany({}),
  ])

  await LatestTeamStatsDashboardMetric.refresh(tenant.id)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

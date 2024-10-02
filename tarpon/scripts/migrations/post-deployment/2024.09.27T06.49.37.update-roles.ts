import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  DASHBOARD_LATEST_TEAM_ALERTS_STATS_HOURLY,
  DASHBOARD_LATEST_TEAM_CASES_STATS_HOURLY,
  DASHBOARD_TEAM_ALERTS_STATS_HOURLY,
  DASHBOARD_TEAM_CASES_STATS_HOURLY,
} from '@/utils/mongodb-definitions'
import { updateRoles } from '@/services/analytics/dashboard-metrics/utils'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()

  const latestAlertsCollectionName = DASHBOARD_LATEST_TEAM_ALERTS_STATS_HOURLY(
    tenant.id
  )
  const latestCasesCollectionName = DASHBOARD_LATEST_TEAM_CASES_STATS_HOURLY(
    tenant.id
  )
  const alertsCollectionName = DASHBOARD_TEAM_ALERTS_STATS_HOURLY(tenant.id)
  const casesCollectionName = DASHBOARD_TEAM_CASES_STATS_HOURLY(tenant.id)

  // Update roles for alerts collection
  await updateRoles(db, latestAlertsCollectionName)
  await updateRoles(db, alertsCollectionName)

  // Update roles for cases collection
  await updateRoles(db, latestCasesCollectionName)
  await updateRoles(db, casesCollectionName)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down = async () => {
  // No down migration needed as this is just updating existing data
}

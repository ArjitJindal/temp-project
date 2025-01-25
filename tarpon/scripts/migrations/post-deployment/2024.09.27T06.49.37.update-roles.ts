import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  DASHBOARD_LATEST_TEAM_ALERTS_STATS_HOURLY,
  DASHBOARD_LATEST_TEAM_CASES_STATS_HOURLY,
  DASHBOARD_TEAM_ALERTS_STATS_HOURLY,
  DASHBOARD_TEAM_CASES_STATS_HOURLY,
} from '@/utils/mongodb-definitions'
import { updateRoles } from '@/services/analytics/dashboard-metrics/utils'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()

  const latestAlertsCollectionName = DASHBOARD_LATEST_TEAM_ALERTS_STATS_HOURLY(
    tenant.id
  )
  const latestCasesCollectionName = DASHBOARD_LATEST_TEAM_CASES_STATS_HOURLY(
    tenant.id
  )
  const alertsCollectionName = DASHBOARD_TEAM_ALERTS_STATS_HOURLY(tenant.id)
  const casesCollectionName = DASHBOARD_TEAM_CASES_STATS_HOURLY(tenant.id)

  const connections = {
    mongoDb,
    dynamoDb: getDynamoDbClient(),
  }
  // Update roles for alerts collection
  await updateRoles(latestAlertsCollectionName, connections)
  await updateRoles(alertsCollectionName, connections)

  // Update roles for cases collection
  await updateRoles(latestCasesCollectionName, connections)
  await updateRoles(casesCollectionName, connections)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down = async () => {
  // No down migration needed as this is just updating existing data
}

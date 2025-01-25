import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient, getMongoDbClientDb } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts/repository'
import {
  DASHBOARD_LATEST_TEAM_ALERTS_STATS_HOURLY,
  DASHBOARD_LATEST_TEAM_CASES_STATS_HOURLY,
  DASHBOARD_TEAM_ALERTS_STATS_HOURLY,
  DASHBOARD_TEAM_CASES_STATS_HOURLY,
} from '@/utils/mongodb-definitions'
import { DashboardStatsRepository } from '@/services/dashboard/repositories/dashboard-stats-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = await getMongoDbClientDb()
  const latestCasesCollection = db.collection(
    DASHBOARD_LATEST_TEAM_CASES_STATS_HOURLY(tenant.id)
  )
  const latestAlertsCollection = db.collection(
    DASHBOARD_LATEST_TEAM_ALERTS_STATS_HOURLY(tenant.id)
  )
  const teamCasesCollection = db.collection(
    DASHBOARD_TEAM_CASES_STATS_HOURLY(tenant.id)
  )
  const teamAlertsCollection = db.collection(
    DASHBOARD_TEAM_ALERTS_STATS_HOURLY(tenant.id)
  )
  const dynamoDb = getDynamoDbClient()

  await Promise.all([
    latestCasesCollection.deleteMany({}),
    latestAlertsCollection.deleteMany({}),
    teamCasesCollection.deleteMany({}),
    teamAlertsCollection.deleteMany({}),
  ])

  const dashboardStatsRepository = new DashboardStatsRepository(tenant.id, {
    mongoDb,
    dynamoDb,
  })
  await dashboardStatsRepository.refreshTeamStats(dynamoDb)
  await dashboardStatsRepository.refreshLatestTeamStats()
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

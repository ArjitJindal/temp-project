import { migrateAllTenants } from '../utils/tenant'
import {
  DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY,
  DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY,
  getMongoDbClient,
} from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'

async function migrateTenant(tenant: Tenant) {
  const { id: tenantId } = tenant
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const collectionNameUserStats =
    DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(tenantId)
  const collectionNameRuleStats =
    DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(tenantId)
  const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
    mongoDb,
  })

  const stats = await db.collection(collectionNameUserStats).find({}).toArray()
  const dates = stats.map((stat) => stat.date) as string[]

  const ruleStats_ = await db
    .collection(collectionNameRuleStats)
    .find({})
    .toArray()

  const ruleStatsDates = ruleStats_.map(
    (stat) => stat._id
  ) as unknown as string[]

  const uniqueDates = new Set([...dates, ...ruleStatsDates])

  for (const date of uniqueDates) {
    dashboardStatsRepository.refreshCaseStats(new Date(`${date}:00`).getTime())
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

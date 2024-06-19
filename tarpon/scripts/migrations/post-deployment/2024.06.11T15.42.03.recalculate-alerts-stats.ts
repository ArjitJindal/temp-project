import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY } from '@/utils/mongodb-definitions'
import { getMongoDbClient, getMongoDbClientDb } from '@/utils/mongodb-utils'
import { DashboardStatsRepository } from '@/services/dashboard/repositories/dashboard-stats-repository'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = await getMongoDbClientDb()
  const tenantId = tenant.id
  const collection = db.collection(
    DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(tenantId)
  )
  const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
    mongoDb,
  })
  await collection.deleteMany({})
  await dashboardStatsRepository.recalculateRuleHitStats()
  await dashboardStatsRepository.refreshAlertsStats()
  await dashboardStatsRepository.refreshQaStats()
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

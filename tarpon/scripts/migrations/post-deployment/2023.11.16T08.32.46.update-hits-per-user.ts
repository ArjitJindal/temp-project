import { migrateAllTenants } from '../utils/tenant'
import { DashboardStatsTransactionsCountData } from '@/@types/openapi-internal/DashboardStatsTransactionsCountData'
import { HitsByUserStatsDashboardMetric } from '@/lambdas/console-api-dashboard/repositories/dashboard-metrics/hits-by-user-stats'
import { Tenant } from '@/services/accounts'
import { DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY } from '@/utils/mongodb-definitions'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'

async function migrateTenant(tenant: Tenant) {
  const db = await getMongoDbClientDb()
  const collection = db.collection<DashboardStatsTransactionsCountData>(
    DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(tenant.id)
  )
  await collection.deleteMany({})
  await HitsByUserStatsDashboardMetric.refreshCaseStats(tenant.id, 'ORIGIN')
  await HitsByUserStatsDashboardMetric.refreshCaseStats(
    tenant.id,
    'DESTINATION'
  )
  await HitsByUserStatsDashboardMetric.refreshTransactionsStats(
    tenant.id,
    'ORIGIN'
  )
  await HitsByUserStatsDashboardMetric.refreshTransactionsStats(
    tenant.id,
    'DESTINATION'
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

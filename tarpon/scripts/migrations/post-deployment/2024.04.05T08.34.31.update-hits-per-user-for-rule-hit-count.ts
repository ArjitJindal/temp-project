import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { DashboardStatsTransactionsCountData } from '@/@types/openapi-internal/DashboardStatsTransactionsCountData'
import { DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY } from '@/utils/mongodb-definitions'
import { HitsByUserStatsDashboardMetric } from '@/services/analytics/dashboard-metrics/hits-by-user-stats'

async function migrateTenant(tenant: Tenant) {
  const db = await getMongoDbClientDb()
  const collection = db.collection<DashboardStatsTransactionsCountData>(
    DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(tenant.id)
  )
  await HitsByUserStatsDashboardMetric.refreshAlertsStats(tenant.id, 'ORIGIN')
  await HitsByUserStatsDashboardMetric.refreshAlertsStats(
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
  await collection.updateMany(
    {},
    { $unset: { transactionsHitCount: '', transactionsCount: '' } }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

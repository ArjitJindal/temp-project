import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DashboardStatsTransactionTypeDistributionStatsTransactionTypeData } from '@/@types/openapi-internal/DashboardStatsTransactionTypeDistributionStatsTransactionTypeData'
import { TRANSACTION_TYPE_DISTRIBUTION_STATS_COLLECTION } from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const collection =
    db.collection<DashboardStatsTransactionTypeDistributionStatsTransactionTypeData>(
      TRANSACTION_TYPE_DISTRIBUTION_STATS_COLLECTION(tenant.id)
    )
  await collection.deleteMany({})
  const dashboardStatsRepository = new DashboardStatsRepository(tenant.id, {
    mongoDb,
  })
  await dashboardStatsRepository.recalculateTransactionTypeDistribution(
    mongoDb.db()
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down = async () => {
  // skip
}

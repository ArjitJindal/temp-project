import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import {
  createCollectionIfNotExist,
  getMongoDbClient,
  syncIndexes,
} from '@/utils/mongodb-utils'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'
import {
  DASHBOARD_USERS_STATS_COLLECTION_DAILY,
  DASHBOARD_USERS_STATS_COLLECTION_HOURLY,
  DASHBOARD_USERS_STATS_COLLECTION_MONTHLY,
  getMongoDbIndexDefinitions,
} from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const dashboardStatsRepository = new DashboardStatsRepository(tenant.id, {
    mongoDb,
  })

  const db = mongoDb.db()
  const allIndexes = getMongoDbIndexDefinitions(tenant.id)
  const collections = [
    DASHBOARD_USERS_STATS_COLLECTION_HOURLY(tenant.id),
    DASHBOARD_USERS_STATS_COLLECTION_DAILY(tenant.id),
    DASHBOARD_USERS_STATS_COLLECTION_MONTHLY(tenant.id),
  ]
  for (const collectionName of collections) {
    const collection = await createCollectionIfNotExist(db, collectionName)
    for (const { getIndexes, unique } of allIndexes[collectionName] ?? []) {
      await syncIndexes(
        collection,
        getIndexes(),
        unique
          ? {
              unique,
            }
          : undefined
      )
    }
  }

  await dashboardStatsRepository.refreshUserStats({})
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

up().then(
  () => {
    console.log('Done')
  },
  (e) => {
    console.error(e)
  }
)

import { migrateAllTenants } from '../utils/tenant'
import { DashboardStatsRepository } from '@/services/dashboard/repositories/dashboard-stats-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts/repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TransactionStatsDashboardMetric } from '@/services/analytics/dashboard-metrics/transaction-stats'
import { hasFeature } from '@/core/utils/context'

async function migrateTenant(tenant: Tenant) {
  if (hasFeature('CLICKHOUSE_ENABLED')) {
    return
  }
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()

  const repository = new DashboardStatsRepository(tenant.id, {
    mongoDb,
    dynamoDb,
  })
  await repository.refreshRuleHitStats({
    startTimestamp: 0,
    endTimestamp: Date.now(),
  })
  // manually refreshing all aggregated stats in mongodb to incorporate newly added fields
  await TransactionStatsDashboardMetric.refresh(tenant.id, {
    startTimestamp: 0,
    endTimestamp: Date.now(),
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

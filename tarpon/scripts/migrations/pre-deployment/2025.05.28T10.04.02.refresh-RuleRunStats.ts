import { migrateAllTenants } from '../utils/tenant'
import { DashboardStatsRepository } from '@/services/dashboard/repositories/dashboard-stats-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts/repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()

  const repository = new DashboardStatsRepository(tenant.id, {
    mongoDb,
    dynamoDb,
  })
  await repository.refreshRuleHitStats({
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

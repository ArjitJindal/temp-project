import { migrateAllTenants } from '../utils/tenant'
import dayjs from '@/utils/dayjs'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { ApiUsageMetricsService } from '@/lambdas/cron-job-midnight/services/api-usage-metrics-service'

async function migrateTenant(tenant: Tenant, auth0Domain: string) {
  if (!process.env.ENV?.startsWith('prod')) {
    return
  }
  if (['kevin', 'bukuwarung'].includes(tenant.name.toLowerCase())) {
    let startTimestamp = 1680652800000
    const endTimestamp = 1683417600000

    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()

    while (startTimestamp <= endTimestamp) {
      const apiMetricsService = new ApiUsageMetricsService(
        tenant,
        { mongoDb, dynamoDb },
        {
          startTimestamp,
          endTimestamp: dayjs(startTimestamp).add(1, 'day').valueOf(),
        }
      )
      await apiMetricsService.publishApiUsageMetrics({
        tenant,
        auth0Domain,
      })

      startTimestamp = dayjs(startTimestamp).add(1, 'day').valueOf()
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

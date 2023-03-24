import { ApiUsageMetricsService } from './services/api-usage-metrics-service'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { TenantService } from '@/services/tenants'

export const apiUsageMetricsHandler = lambdaConsumer()(async () => {
  const tenantInfos = await TenantService.getAllTenants()
  const mongoDb = await getMongoDbClient()
  const dynamoDb = await getDynamoDbClient()

  for await (const tenant of tenantInfos) {
    const apiMetricsService = new ApiUsageMetricsService(tenant.tenant.id, {
      mongoDb,
      dynamoDb,
    })

    await apiMetricsService.publishApiUsageMetrics(tenant)
  }
})

import { ApiUsageMetricsService } from './services/api-usage-metrics-service'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { TenantService } from '@/services/tenants'

export const apiUsageMetricsHandler = lambdaConsumer()(async () => {
  const tenantInfos = await TenantService.getAllTenants(
    process.env.ENV as 'dev' | 'sandbox' | 'prod',
    process.env.REGION as 'eu-1' | 'asia-1' | 'asia-2' | 'us-1' | 'eu-2'
  )

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

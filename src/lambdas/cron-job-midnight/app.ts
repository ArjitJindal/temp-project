import { ApiUsageMetricsService } from './services/api-usage-metrics-service'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { TenantService } from '@/services/tenants'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'
import { sendBatchJobCommand } from '@/services/batch-job'
import { OngoingScreeningUserRuleBatchJob } from '@/@types/batch-job'

export const cronJobMidnightHandler = lambdaConsumer()(async () => {
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
    const tenantId = tenant.tenant.id
    if (await tenantHasFeature(tenantId, 'SANCTIONS')) {
      await sendBatchJobCommand(tenantId, {
        type: 'ONGOING_SCREENING_USER_RULE',
        tenantId,
      } as OngoingScreeningUserRuleBatchJob)
    }
  }
})

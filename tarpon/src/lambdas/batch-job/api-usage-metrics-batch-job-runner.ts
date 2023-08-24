import { BatchJobRunner } from './batch-job-runner-base'
import { ApiUsageMetricsBatchJob } from '@/@types/batch-job'
import { ApiUsageMetricsService } from '@/services/metrics/api-usage-metrics-service'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export class ApiUsageMetricsBatchJobRunner extends BatchJobRunner {
  protected async run(job: ApiUsageMetricsBatchJob): Promise<any> {
    const { tenantInfos, targetMonth, googleSheetIds } = job
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const apiMetricsService = new ApiUsageMetricsService({
      mongoDb,
      dynamoDb,
    })

    for (const tenant of tenantInfos) {
      await apiMetricsService.publishApiUsageMetrics(
        tenant,
        targetMonth,
        googleSheetIds
      )
    }
  }
}

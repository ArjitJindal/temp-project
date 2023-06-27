import { BatchJobRunner } from './batch-job-runner-base'
import { ApiUsageMetricsBatchJob } from '@/@types/batch-job'
import { ApiUsageMetricsService } from '@/services/metrics/api-usage-metrics-service'
import dayjs from '@/utils/dayjs'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongoDBUtils'

export class ApiUsageMetricsBatchJobRunner extends BatchJobRunner {
  public async run(job: ApiUsageMetricsBatchJob): Promise<void> {
    const { tenantInfo } = job
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const timestamp = dayjs().subtract(2, 'day').valueOf()
    const startTimestamp = dayjs(timestamp).startOf('day').valueOf()
    const endTimestamp = dayjs(timestamp).endOf('day').valueOf()

    const apiMetricsService = new ApiUsageMetricsService(
      tenantInfo,
      { mongoDb, dynamoDb },
      { startTimestamp, endTimestamp }
    )

    await apiMetricsService.publishApiUsageMetrics(tenantInfo)
  }
}

import { BatchJobRunner } from './batch-job-runner-base'
import { NangoService } from '@/services/nango'
import { NangoDataFetchBatchJob } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'

export class NangoDataFetchBatchJobRunner extends BatchJobRunner {
  async run(job: NangoDataFetchBatchJob) {
    const dynamoDb = getDynamoDbClient()
    const nangoService = new NangoService(dynamoDb)

    await nangoService.recieveWebhook(
      job.tenantId,
      job.parameters.webhookData,
      job.parameters.region
    )
  }
}

import { WebhookRetryRepository } from '../webhook/repositories/webhook-retry-repository'
import { retryWebhookTasks } from '../webhook/utils'
import { BatchJobRunner } from './batch-job-runner-base'
import { WebhookRetryBatchJob } from '@/@types/batch-job'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export class WebhookRetryBatchJobRunner extends BatchJobRunner {
  protected async run(job: WebhookRetryBatchJob): Promise<void> {
    const { tenantId } = job
    const mongoDb = await getMongoDbClient()

    const webhookRetryRepository = new WebhookRetryRepository(tenantId, mongoDb)
    const webhookRetryEvents =
      await webhookRetryRepository.getAllWebhookRetryEvents()

    await retryWebhookTasks(
      tenantId,
      webhookRetryEvents.map((data) => data.task)
    )
  }
}

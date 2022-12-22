import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { BatchJob } from '@/@types/batch-job'
import { logger } from '@/core/logger'

const sqsClient = new SQSClient({})

export async function sendBatchJobCommand(
  tenantId: string,
  job: Omit<BatchJob, 'tenantId'>
) {
  const batchJob: Partial<BatchJob> = {
    ...job,
    tenantId,
  }
  await sqsClient.send(
    new SendMessageCommand({
      MessageBody: JSON.stringify(batchJob),
      QueueUrl: process.env.BATCH_JOB_QUEUE_URL as string,
    })
  )
  logger.info(`Sent batch job ${job.type}`, batchJob)
}

import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { BatchJob } from '@/@types/batch-job'
import { logger } from '@/core/logger'
import { getBatchJobRunner } from '@/services/batch-jobs/batch-job-runner-factory'
import { envIs } from '@/utils/env'

const sqsClient = new SQSClient({})

export async function sendBatchJobCommand(job: BatchJob) {
  if (envIs('local')) {
    await getBatchJobRunner(job.type).execute(job)
    return
  }

  if (envIs('test')) {
    return
  }

  await sqsClient.send(
    new SendMessageCommand({
      MessageBody: JSON.stringify(job),
      QueueUrl: process.env.BATCH_JOB_QUEUE_URL as string,
    })
  )
  logger.info(`Sent batch job ${job.type}`, job)
}

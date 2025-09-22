import { SendMessageCommand } from '@aws-sdk/client-sqs'
import { v4 as uuidv4 } from 'uuid'
import { BatchJob, BatchJobWithId } from '@/@types/batch-job'
import { logger } from '@/core/logger'
import { envIs } from '@/utils/env'
import { getSQSClient } from '@/utils/sns-sqs-client'

const sqsClient = getSQSClient()

export async function sendBatchJobCommand(job: BatchJob, jobId?: string) {
  if (envIs('test') || job.tenantId === 'cypress-tenant') {
    return
  }

  const jobWithId: BatchJobWithId = {
    ...job,
    jobId: jobId ?? uuidv4(),
  }
  if (envIs('local')) {
    const { handleBatchJob } = await import('@/core/local-handlers/batch-job')
    await handleBatchJob(jobWithId)
    return
  }

  await sqsClient.send(
    new SendMessageCommand({
      MessageBody: JSON.stringify(jobWithId),
      QueueUrl: process.env.BATCH_JOB_QUEUE_URL as string,
    })
  )
  logger.warn(`Sent batch job ${jobWithId.type}`, jobWithId)
}

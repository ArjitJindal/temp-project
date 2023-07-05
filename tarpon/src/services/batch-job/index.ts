import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { BatchJob } from '@/@types/batch-job'
import { logger } from '@/core/logger'
import { BatchJobRunnerFactory } from '@/lambdas/batch-job/batch-job-runner-factory'

const sqsClient = new SQSClient({})

export async function sendBatchJobCommand(
  tenantId: string,
  job: Omit<BatchJob, 'tenantId'>
) {
  const batchJob: Partial<BatchJob> = {
    ...job,
    tenantId,
  }

  if (process.env.ENV === 'local' && process.env.EXEC_SOURCE !== 'CI') {
    const jobRunner = BatchJobRunnerFactory.getBatchJobRunner(job.type)
    await jobRunner.execute(batchJob as BatchJob)
    return
  }

  await sqsClient.send(
    new SendMessageCommand({
      MessageBody: JSON.stringify(batchJob),
      QueueUrl: process.env.BATCH_JOB_QUEUE_URL as string,
    })
  )
  logger.info(`Sent batch job ${job.type}`, batchJob)
}

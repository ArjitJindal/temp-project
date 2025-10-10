import { SQSEvent } from 'aws-lambda'
import {
  ExecutionAlreadyExists,
  SFNClient,
  StartExecutionCommand,
} from '@aws-sdk/client-sfn'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { BatchJobWithId } from '@/@types/batch-job'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { BatchJobRepository } from '@/services/batch-jobs/repositories/batch-job-repository'
import { logger } from '@/core/logger'

function getBatchJobName(job: BatchJobWithId) {
  return `${job.tenantId}-${job.type}-${job.jobId}`.slice(0, 80)
}

export const jobTriggerHandler = lambdaConsumer()(async (event: SQSEvent) => {
  const sfnClient = new SFNClient({
    region: process.env.ENV === 'local' ? 'local' : process.env.AWS_REGION,
    maxAttempts: 5,
    retryMode: 'standard',
  })

  for (const record of event.Records) {
    const job = JSON.parse(record.body) as BatchJobWithId
    const jobName = getBatchJobName(job)
    const mongoDb = await getMongoDbClient()
    const jobRepository = new BatchJobRepository(job.tenantId, mongoDb)
    const existingJob = await jobRepository.getJobById(job.jobId)
    if (!existingJob) {
      await jobRepository.insertJob(job)
    }

    try {
      await sfnClient.send(
        new StartExecutionCommand({
          stateMachineArn: process.env.BATCH_JOB_STATE_MACHINE_ARN,
          name: jobName,
          input: record.body,
        })
      )
      logger.info(`Job ${jobName} started`, { jobName, batchJobPayload: job })
    } catch (e) {
      if (!(e instanceof ExecutionAlreadyExists)) {
        throw e
      }
    }
  }
})

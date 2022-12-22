import { SQSEvent } from 'aws-lambda'
import { v4 as uuidv4 } from 'uuid'
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import { BatchJobRunnerFactory } from './batch-job-runner-factory'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { BatchJob } from '@/@types/batch-job'
import { logger } from '@/core/logger'

type BatchRunType = 'LAMBDA' | 'FARGATE'
export const LAMBDA_BATCH_JOB_RUN_TYPE: BatchRunType = 'LAMBDA'
export const FARGATE_BATCH_JOB_RUN_TYPE: BatchRunType = 'FARGATE'
export const BATCH_JOB_RUN_TYPE_RESULT_KEY = 'BatchJobRunType'
export const BATCH_JOB_PAYLOAD_RESULT_KEY = 'BatchJobPayload'

function getBatchJobName(batchJobPayload: BatchJob) {
  return `${batchJobPayload.tenantId}-${batchJobPayload.type}-${uuidv4()}`
}

export const jobTriggerHandler = lambdaConsumer()(async (event: SQSEvent) => {
  const sfnClient = new SFNClient({
    region: process.env.ENV === 'local' ? 'local' : process.env.AWS_REGION,
  })

  for (const record of event.Records) {
    const batchJobPayload = JSON.parse(record.body) as BatchJob
    const jobName = getBatchJobName(batchJobPayload)
    await sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn: process.env.BATCH_JOB_STATE_MACHINE_ARN,
        name: jobName,
        input: record.body,
      })
    )
    logger.info(`Job ${jobName} started`, { jobName, batchJobPayload })
  }
})

// TODO: Implement Fargate path. For now, all jobs are run using lambda job runner
export const jobDecisionHandler = async (
  job: BatchJob
): Promise<{
  [BATCH_JOB_RUN_TYPE_RESULT_KEY]: BatchRunType
  [BATCH_JOB_PAYLOAD_RESULT_KEY]: any
}> => {
  return {
    [BATCH_JOB_RUN_TYPE_RESULT_KEY]: LAMBDA_BATCH_JOB_RUN_TYPE,
    [BATCH_JOB_PAYLOAD_RESULT_KEY]: job,
  }
}

export const jobRunnerHandler = async (job: BatchJob) => {
  logger.info(`Starting job - ${job.type}`, job)
  const jobRunner = BatchJobRunnerFactory.getBatchJobRunner(job.type)
  return jobRunner.run(job)
}

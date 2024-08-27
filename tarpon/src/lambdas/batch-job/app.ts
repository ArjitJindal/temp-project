import { SQSEvent } from 'aws-lambda'
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import {
  BATCH_JOB_PAYLOAD_RESULT_KEY,
  BATCH_JOB_RUN_TYPE_RESULT_KEY,
  BatchRunType,
} from '@lib/cdk/constants'
import { getBatchJobRunner } from '@/services/batch-jobs/batch-job-runner-factory'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { BatchJob, BatchJobWithId } from '@/@types/batch-job'
import { logger } from '@/core/logger'
import {
  initializeTenantContext,
  updateLogMetadata,
} from '@/core/utils/context'
import { BatchJobRepository } from '@/services/batch-jobs/repositories/batch-job-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'

function getBatchJobName(job: BatchJobWithId) {
  return `${job.tenantId}-${job.type}-${job.jobId}`.slice(0, 80)
}

export const jobTriggerHandler = lambdaConsumer()(async (event: SQSEvent) => {
  const sfnClient = new SFNClient({
    region: process.env.ENV === 'local' ? 'local' : process.env.AWS_REGION,
  })

  for (const record of event.Records) {
    const job = JSON.parse(record.body) as BatchJobWithId
    const jobName = getBatchJobName(job)
    const jobRepository = new BatchJobRepository(
      job.tenantId,
      await getMongoDbClient()
    )
    const existingJob = await jobRepository.getJobById(job.jobId)
    if (!existingJob) {
      await jobRepository.insertJob(job)
    }

    await sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn: process.env.BATCH_JOB_STATE_MACHINE_ARN,
        name: jobName,
        input: record.body,
      })
    )
    logger.info(`Job ${jobName} started`, { jobName, batchJobPayload: job })
  }
})

export const jobDecisionHandler = async (
  job: BatchJobWithId
): Promise<{
  [BATCH_JOB_RUN_TYPE_RESULT_KEY]: BatchRunType
  [BATCH_JOB_PAYLOAD_RESULT_KEY]: any
}> => {
  const BATCH_JOB_AND_RUN_TYPE_MAP: {
    [key in BatchJob['type']]: BatchRunType
  } = {
    DASHBOARD_REFRESH: 'LAMBDA',
    API_USAGE_METRICS: 'LAMBDA',
    DEMO_MODE_DATA_LOAD: 'LAMBDA',
    FILE_IMPORT: 'LAMBDA',
    GLOBAL_RULE_AGGREGATION_REBUILD: 'LAMBDA',
    ONGOING_SCREENING_USER_RULE: 'FARGATE',
    PULSE_USERS_BACKFILL_RISK_SCORE: 'LAMBDA',
    SIMULATION_BEACON: 'FARGATE',
    SIMULATION_PULSE: 'LAMBDA',
    ONGOING_MERCHANT_MONITORING: 'LAMBDA',
    SYNC_INDEXES: 'LAMBDA',
    TEST_FARGATE: 'FARGATE',
    TENANT_DELETION: 'FARGATE',
    SIMULATION_RISK_FACTORS: 'FARGATE',
    RULE_PRE_AGGREGATION: 'FARGATE',
    FILES_AI_SUMMARY: 'LAMBDA',
    ALERT_SLA_STATUS_REFRESH: 'LAMBDA',
    REVERIFY_TRANSACTIONS: 'FARGATE',
    SANCTIONS_DATA_FETCH: 'FARGATE',
  }

  return {
    [BATCH_JOB_RUN_TYPE_RESULT_KEY]: BATCH_JOB_AND_RUN_TYPE_MAP[job.type],
    [BATCH_JOB_PAYLOAD_RESULT_KEY]:
      BATCH_JOB_AND_RUN_TYPE_MAP[job.type] == 'LAMBDA'
        ? job
        : {
            jobId: job.jobId,
            type: job.type,
            tenantId: job.tenantId,
            awsCredentials: job['awsCredentials'],
          },
  }
}

export const genericJobRunnerHandler = async (job: BatchJobWithId) => {
  await initializeTenantContext(job.tenantId)
  updateLogMetadata({
    jobId: job.jobId,
    type: job.type,
    tenantId: job.tenantId,
  })
  logger.info(`Starting job - ${job.type}`, job)

  const jobRepository = new BatchJobRepository(
    job.tenantId,
    await getMongoDbClient()
  )
  try {
    await jobRepository.updateJobStatus(job.jobId, 'IN_PROGRESS')
    await getBatchJobRunner(job.type, job.jobId).execute(job)
    await jobRepository.updateJobStatus(job.jobId, 'SUCCESS')
  } catch (error) {
    await jobRepository.updateJobStatus(job.jobId, 'FAILED')
    throw error
  }
}

export const jobRunnerHandler = lambdaConsumer()(genericJobRunnerHandler)

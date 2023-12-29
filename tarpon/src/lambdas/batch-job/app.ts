import { SQSEvent } from 'aws-lambda'
import { v4 as uuidv4 } from 'uuid'
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import {
  BATCH_JOB_PAYLOAD_RESULT_KEY,
  BATCH_JOB_RUN_TYPE_RESULT_KEY,
  BatchRunType,
} from '@lib/cdk/constants'
import { getBatchJobRunner } from '@/services/batch-jobs/batch-job-runner-factory'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { BatchJob } from '@/@types/batch-job'
import { logger } from '@/core/logger'
import {
  initializeTenantContext,
  updateLogMetadata,
} from '@/core/utils/context'

function getBatchJobName(batchJobPayload: BatchJob) {
  return `${uuidv4()}-${batchJobPayload.tenantId}-${
    batchJobPayload.type
  }`.slice(0, 80)
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

export const jobDecisionHandler = async (
  job: BatchJob
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
    ONGOING_SCREENING_USER_RULE: 'LAMBDA',
    PULSE_USERS_BACKFILL_RISK_SCORE: 'LAMBDA',
    SIMULATION_BEACON: 'LAMBDA',
    SIMULATION_PULSE: 'LAMBDA',
    ONGOING_MERCHANT_MONITORING: 'LAMBDA',
    SYNC_INDEXES: 'LAMBDA',
    TEST_FARGATE: 'FARGATE',
    TENANT_DELETION: 'FARGATE',
  }

  return {
    [BATCH_JOB_RUN_TYPE_RESULT_KEY]: BATCH_JOB_AND_RUN_TYPE_MAP[job.type],
    [BATCH_JOB_PAYLOAD_RESULT_KEY]: job,
  }
}

export const jobRunnerHandler = lambdaConsumer()(async (job: BatchJob) => {
  logger.info(`Starting job - ${job.type}`, job)
  await initializeTenantContext(job.tenantId)
  updateLogMetadata({
    type: job.type,
    tenantId: job.tenantId,
    runner: 'LAMBDA',
  })
  return getBatchJobRunner(job.type).execute(job)
})

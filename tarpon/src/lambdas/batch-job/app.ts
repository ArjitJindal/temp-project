import { SQSEvent } from 'aws-lambda'
import {
  ExecutionAlreadyExists,
  ListExecutionsCommand,
  ListExecutionsCommandInput,
  SFNClient,
  StartExecutionCommand,
} from '@aws-sdk/client-sfn'
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
  tenantSettings,
  updateLogMetadata,
} from '@/core/utils/context'
import { BatchJobRepository } from '@/services/batch-jobs/repositories/batch-job-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { LONG_RUNNING_MIGRATION_TENANT_ID } from '@/services/batch-jobs/batch-job'

function getBatchJobName(job: BatchJobWithId) {
  return `${job.tenantId}-${job.type}-${job.jobId}`.slice(0, 80)
}

async function getRunningJobs(
  stateMachineArn: string | undefined,
  jobName: string,
  sfnClient: SFNClient
): Promise<boolean> {
  try {
    const params: ListExecutionsCommandInput = {
      stateMachineArn,
      statusFilter: 'RUNNING',
    }

    const command = new ListExecutionsCommand(params)
    const response = await sfnClient.send(command)

    // Filter the jobs by name
    const runningJobs = response?.executions?.filter(
      (execution) => execution && execution.name?.includes(jobName)
    )

    return (runningJobs?.length ?? 0) > 0
  } catch (error) {
    logger.error('Error fetching running jobs:', error)
    throw error
  }
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
    const jobRepository = new BatchJobRepository(
      job.tenantId,
      await getMongoDbClient()
    )
    const existingJob = await jobRepository.getJobById(job.jobId)
    if (!existingJob) {
      await jobRepository.insertJob(job)
    }
    let areSLAJobsRunning: boolean | undefined

    // TODO: Remove this once we have a proper way to handle this in FR-5951
    if (
      job.tenantId?.startsWith('pnb') &&
      job.type === 'ALERT_SLA_STATUS_REFRESH'
    ) {
      areSLAJobsRunning =
        areSLAJobsRunning ??
        (await getRunningJobs(
          process.env.BATCH_JOB_STATE_MACHINE_ARN,
          `${job.tenantId}-ALERT_SLA_STATUS_REFRESH`, // Adding it to make SLA jobs idempotent, as the payload is same for all the jobs
          sfnClient
        ))

      if (areSLAJobsRunning) {
        logger.info(`Job ${jobName} is already running`, {
          jobName,
          batchJobPayload: job,
        })
        return
      }
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

export const jobDecisionHandler = async (
  job: BatchJobWithId
): Promise<{
  [BATCH_JOB_RUN_TYPE_RESULT_KEY]: BatchRunType
  [BATCH_JOB_PAYLOAD_RESULT_KEY]: any
}> => {
  const settings =
    job.tenantId === LONG_RUNNING_MIGRATION_TENANT_ID
      ? {}
      : await tenantSettings(job.tenantId)

  const BATCH_JOB_AND_RUN_TYPE_MAP: {
    [key in BatchJob['type']]: BatchRunType
  } = {
    DASHBOARD_REFRESH: settings.features?.includes('MANUAL_DASHBOARD_REFRESH')
      ? 'FARGATE'
      : 'LAMBDA',
    API_USAGE_METRICS: 'LAMBDA',
    DEMO_MODE_DATA_LOAD: 'LAMBDA',
    GLOBAL_RULE_AGGREGATION_REBUILD: 'LAMBDA',
    ONGOING_SCREENING_USER_RULE: 'FARGATE',
    PULSE_USERS_BACKFILL_RISK_SCORE: 'LAMBDA',
    WEBHOOK_RETRY: 'LAMBDA',
    SIMULATION_BEACON: 'FARGATE',
    SIMULATION_PULSE: 'LAMBDA',
    SYNC_DATABASES: 'LAMBDA',
    TEST_FARGATE: 'FARGATE',
    BACKFILL_ASYNC_RULE_RUNS: 'FARGATE',
    PNB_BACKFILL_ENTITIES: 'FARGATE',
    PNB_BACKFILL_TRANSACTIONS: 'FARGATE',
    PNB_BACKFILL_KRS: 'FARGATE',
    PNB_BACKFILL_CRA: 'FARGATE',
    PNB_BACKFILL_HAMMERHEAD: 'FARGATE',
    PNB_BACKFILL_ARS: 'FARGATE',
    PNB_BACKFILL_WEBHOOK_DELIVERIES: 'FARGATE',
    TENANT_DELETION: 'FARGATE',
    SIMULATION_RISK_FACTORS: 'FARGATE',
    RULE_PRE_AGGREGATION: 'FARGATE',
    MANUAL_RULE_PRE_AGGREGATION: 'FARGATE',
    FILES_AI_SUMMARY: 'LAMBDA',
    // TODO: Remove this once we have a proper way to handle this in FR-5951
    ALERT_SLA_STATUS_REFRESH: settings.features?.includes('PNB')
      ? 'FARGATE'
      : 'LAMBDA',
    REVERIFY_TRANSACTIONS: 'FARGATE',
    SANCTIONS_DATA_FETCH: 'FARGATE',
    BACKFILL_AVERAGE_TRS: 'LAMBDA',
    RISK_SCORING_RECALCULATION: 'FARGATE',
    SIMULATION_RISK_FACTORS_V8: 'FARGATE',
    CASE_SLA_STATUS_REFRESH: 'LAMBDA',
    FIX_RISK_SCORES_FOR_PNB_USERS: 'FARGATE',
    NANGO_DATA_FETCH: 'LAMBDA',
    FINCEN_REPORT_STATUS_REFRESH: 'LAMBDA',
    AGGREGATION_CLEANUP: 'FARGATE',
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
  if (job.tenantId !== LONG_RUNNING_MIGRATION_TENANT_ID) {
    // Skipping as we are creating job per region and context should be handled per tenant
    await initializeTenantContext(job.tenantId)
  }
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

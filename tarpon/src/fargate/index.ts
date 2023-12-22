import { BATCH_JOB_PAYLOAD_ENV_VAR } from '@lib/cdk/constants'
import { BatchJob } from '@/@types/batch-job'
import { logger } from '@/core/logger'
import {
  initializeTenantContext,
  updateLogMetadata,
} from '@/core/utils/context'
import { getBatchJobRunner } from '@/services/batch-jobs/batch-job-runner-factory'
import { nodeConsumer } from '@/core/middlewares/node-consumer-middleware'

const handler = nodeConsumer()(async () => {
  const jobString = process.env[BATCH_JOB_PAYLOAD_ENV_VAR] as string
  const job: BatchJob = JSON.parse(jobString) as BatchJob
  await initializeTenantContext(job.tenantId)

  logger.info(`Starting job - ${job.type}`, job)

  updateLogMetadata({
    type: job.type,
    tenantId: job.tenantId,
    runner: 'FARGATE',
  })

  const batchJob = getBatchJobRunner(job.type)
  await batchJob.execute(job)
})

void handler()
  .then(() => {
    logger.info('Batch job completed')
    process.exit(0) // Lets ensure we exit with success: Some times it may happen container is not stopped
  })
  .catch((error) => {
    logger.error('Batch job failed', error)
    process.exit(1) // Failure
  })

import { getBatchJobRunner } from '@/services/batch-jobs/batch-job-runner-factory'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { BatchJobWithId } from '@/@types/batch-job'
import { logger } from '@/core/logger'
import {
  initializeTenantContext,
  updateLogMetadata,
} from '@/core/utils/context'
import { BatchJobRepository } from '@/services/batch-jobs/repositories/batch-job-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { LONG_RUNNING_MIGRATION_TENANT_ID } from '@/utils/batch-job'

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

  logger.debug(`Job ${job.jobId} completed`, {
    jobId: job.jobId,
    type: job.type,
    tenantId: job.tenantId,
  })
}

export const jobRunnerHandler = lambdaConsumer()(genericJobRunnerHandler)

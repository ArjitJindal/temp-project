import { Stage } from '@flagright/lib/constants/deploy'
import { getMongoDbClient } from './mongodb-utils'
import { BatchJobRepository } from '@/services/batch-jobs/repositories/batch-job-repository'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { BatchJobType } from '@/@types/batch-job'
import { logger } from '@/core/logger'

export const skippedTenantsClickhouseCheckForDashboardRefresh: Record<
  Stage,
  string[]
> = {
  sandbox: ['1d2bd6c62c', 'flagright_kevin', 'flagright'],
  test: [],
  deploy: [],
  local: [],
  dev: [],
  prod: [],
}

export async function handleBatchJobTrigger(
  tenantIds: string[],
  jobNames: BatchJobType[]
) {
  const mongoDb = await getMongoDbClient()
  try {
    await Promise.all(
      tenantIds.map(async (id) => {
        const batchJobRepository = new BatchJobRepository(id, mongoDb)
        const pendingTriggerJobs = await batchJobRepository.getJobsByStatus(
          ['PENDING'],
          {
            filterTypes: jobNames,
          }
        )
        for (const job of pendingTriggerJobs) {
          if (
            job.latestStatus.scheduledAt &&
            job.latestStatus.scheduledAt <= Date.now()
          ) {
            await sendBatchJobCommand(job, job.jobId)
          }
        }
      })
    )
  } catch (e) {
    logger.error(
      `Failed to send batch jobs for ${jobNames.join(',')} : ${
        (e as Error)?.message
      }`,
      e
    )
  }
}

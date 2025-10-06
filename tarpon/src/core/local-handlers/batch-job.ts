import { BatchJobWithId } from '@/@types/batch-job'
import { BatchJobRepository } from '@/services/batch-jobs/repositories/batch-job-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export const handleBatchJob = async (jobWithId: BatchJobWithId) => {
  const jobRepository = new BatchJobRepository(
    jobWithId.tenantId,
    await getMongoDbClient()
  )
  await jobRepository.insertJob(jobWithId)

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { jobRunnerHandler } = require('@/lambdas/batch-job-runner/app')

  jobRunnerHandler(jobWithId)
  return
}

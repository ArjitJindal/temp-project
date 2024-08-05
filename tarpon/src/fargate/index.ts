import {
  BATCH_JOB_ID_ENV_VAR,
  BATCH_JOB_TENANT_ID_ENV_VAR,
} from '@lib/cdk/constants'
import { logger } from '@/core/logger'
import { nodeConsumer } from '@/core/middlewares/node-consumer-middleware'
import { genericJobRunnerHandler } from '@/lambdas/batch-job/app'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { BatchJobRepository } from '@/services/batch-jobs/repositories/batch-job-repository'

const handler = nodeConsumer()(async () => {
  const jobId = process.env[BATCH_JOB_ID_ENV_VAR] as string
  const tenantId = process.env[BATCH_JOB_TENANT_ID_ENV_VAR] as string
  const client = await getMongoDbClient()
  const bjr = new BatchJobRepository(tenantId, client)
  const job = await bjr.getJobById(jobId)
  if (!job) {
    logger.error(`Job not found for jobId: ${jobId}`)
    return
  }
  try {
    await genericJobRunnerHandler(job)
  } catch (e) {
    logger.error(e)
    throw e
  }
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

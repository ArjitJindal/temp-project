import { BATCH_JOB_PAYLOAD_ENV_VAR } from '@lib/cdk/constants'
import { BatchJobWithId } from '@/@types/batch-job'
import { logger } from '@/core/logger'
import { nodeConsumer } from '@/core/middlewares/node-consumer-middleware'
import { genericJobRunnerHandler } from '@/lambdas/batch-job/app'

const handler = nodeConsumer()(async () => {
  const jobString = process.env[BATCH_JOB_PAYLOAD_ENV_VAR] as string
  const job = JSON.parse(jobString) as BatchJobWithId
  await genericJobRunnerHandler(job)
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

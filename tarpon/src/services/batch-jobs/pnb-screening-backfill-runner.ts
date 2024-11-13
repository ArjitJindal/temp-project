import { range } from 'lodash'
import { BatchJobRunner } from './batch-job-runner-base'
import { PnbScreeningBackfillJob } from '@/@types/batch-job'
import { traceable } from '@/core/xray'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { logger } from '@/core/logger'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'

const NUMBER_OF_JOBS = process.env.MULTI_SCREENING_JOBS
  ? parseInt(process.env.MULTI_SCREENING_JOBS)
  : 50

@traceable
export class PnbScreeningBackfillRunner extends BatchJobRunner {
  protected async run(job: PnbScreeningBackfillJob): Promise<void> {
    if (!job.tenantId.includes('pnb')) {
      logger.warn(`Skipping because tenant is not pnb: ${job.tenantId}`)
      return
    }

    logger.warn(`Drop sanctions screening details in clickhouse`)
    const mongoDB = await getMongoDbClient()
    const users = mongoDB
      ?.db()
      .collection<InternalUser>(USERS_COLLECTION(job.tenantId as string))
    if (!users) {
      return
    }
    const totalDocs = await users.estimatedDocumentCount()
    const batchSize = Math.ceil(totalDocs / NUMBER_OF_JOBS)
    logger.warn(`${totalDocs} users for screening`)
    logger.warn(`Creating batches of ${batchSize} size`)
    const froms = (
      await Promise.all(
        range(NUMBER_OF_JOBS).map(async (i): Promise<string | null> => {
          const user = (
            await users
              .find({})
              .sort({ userId: 1 })
              .skip(i * batchSize)
              .limit(1)
              .toArray()
          )[0]

          if (user) {
            return user.userId
          }
          return null
        })
      )
    ).filter((p): p is string => Boolean(p))

    logger.warn(`Cursors: ${JSON.stringify(froms)}`)
    for (let i = 0; i < froms.length - 1; i++) {
      const from = froms[i]
      const to = froms[i + 1]

      logger.warn(`Sending batch job #${i}`)
      await sendBatchJobCommand({
        type: 'ONGOING_SCREENING_USER_RULE',
        tenantId: job.tenantId,
        from,
        to,
      })
    }
    return
  }
}

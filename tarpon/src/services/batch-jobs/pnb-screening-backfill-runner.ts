import { range } from 'lodash'
import { BatchJobRunner } from './batch-job-runner-base'
import { PnbScreeningBackfillJob } from '@/@types/batch-job'
import { traceable } from '@/core/xray'
import {
  createMongoDBCollections,
  getMongoDbClient,
} from '@/utils/mongodb-utils'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import {
  CASES_COLLECTION,
  SANCTIONS_HITS_COLLECTION,
  SANCTIONS_PROVIDER_SEARCHES_COLLECTION,
  SANCTIONS_SCREENING_DETAILS_COLLECTION,
  SANCTIONS_SEARCHES_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { logger } from '@/core/logger'
import { Case } from '@/@types/openapi-internal/Case'
import { envIs } from '@/utils/env'
import { getClickhouseClient } from '@/utils/clickhouse/utils'

const NUMBER_OF_JOBS = process.env.MULTI_SCREENING_JOBS
  ? parseInt(process.env.MULTI_SCREENING_JOBS)
  : 10

@traceable
export class PnbScreeningBackfillRunner extends BatchJobRunner {
  protected async run(job: PnbScreeningBackfillJob): Promise<void> {
    if (!envIs('sandbox')) {
      logger.warn('Skipping because env is not sandbox')
      return
    }
    if (!job.tenantId.includes('pnb')) {
      logger.warn(`Skipping because tenant is not pnb: ${job.tenantId}`)
      return
    }
    const client = await getMongoDbClient()

    // Remove all sanctions hits to refresh the state
    await client
      .db()
      .collection<Case>(CASES_COLLECTION(job.tenantId))
      .updateMany(
        {}, // Apply to all documents
        {
          $pull: {
            alerts: {
              ruleId: 'R-18',
            },
          },
        }
      )

    logger.warn('Clear sanctions data')
    await Promise.all(
      [
        SANCTIONS_HITS_COLLECTION,
        SANCTIONS_SEARCHES_COLLECTION,
        SANCTIONS_PROVIDER_SEARCHES_COLLECTION,
        SANCTIONS_SCREENING_DETAILS_COLLECTION,
      ].map(async (collFn) => {
        try {
          const result = await client
            .db()
            .collection(collFn(job.tenantId))
            .drop()
          logger.warn(`Collection dropped: ${result}`)
        } catch (e) {
          logger.warn(e)
        }
      })
    )

    logger.warn(`Drop sanctions screening details in clickhouse`)
    const clickhouseClient = await getClickhouseClient(job.tenantId)
    await clickhouseClient.query({
      query: `alter table tarpon_${job.tenantId.replace(
        '-',
        '_'
      )}.sanctions_screening_details delete where 1 = 1`,
    })

    logger.warn('Creating mongo collections that are missing')
    await createMongoDBCollections(client, job.tenantId)

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

import { range } from 'lodash'
import { backOff } from 'exponential-backoff'
import { BatchJobRunner } from './batch-job-runner-base'
import { SanctionsDataFetchBatchJob } from '@/@types/batch-job'
import { sanctionsDataFetchers } from '@/services/sanctions/data-fetchers'
import { MongoSanctionsRepository } from '@/services/sanctions/repositories/sanctions-repository'
import dayjs from '@/utils/dayjs'
import { logger } from '@/core/logger'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import {
  DELTA_SANCTIONS_COLLECTION,
  SANCTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import {
  createGlobalMongoDBCollections,
  getMongoDbClient,
} from '@/utils/mongodb-utils'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'

export class SanctionsDataFetchBatchJobRunner extends BatchJobRunner {
  protected async run(job: SanctionsDataFetchBatchJob): Promise<void> {
    const { tenantId } = job
    const fetchers = await sanctionsDataFetchers(tenantId)
    const runFullLoad = job.parameters?.from
      ? new Date(job.parameters.from).getDay() === 0
      : true
    const version = Date.now().toString()
    logger.info(`Running ${runFullLoad ? 'full' : 'delta'} load`)
    const sanctionsCollectionName = SANCTIONS_COLLECTION(tenantId)
    const deltaSanctionsCollectionName = DELTA_SANCTIONS_COLLECTION(tenantId)
    const client = await getMongoDbClient()

    for (const fetcher of fetchers) {
      logger.info(`Running ${fetcher.constructor.name}`)
      if (runFullLoad) {
        await createGlobalMongoDBCollections(client)
        const repo = new MongoSanctionsRepository(sanctionsCollectionName)
        await fetcher.fullLoad(repo, version)
        await checkSearchIndexesReady(sanctionsCollectionName)
      } else {
        const repo = new MongoSanctionsRepository(sanctionsCollectionName)
        await fetcher.delta(repo, version, dayjs(job.parameters.from).toDate())

        await client
          .db()
          .collection(deltaSanctionsCollectionName)
          .deleteMany({})
        const deltaRepo = new MongoSanctionsRepository(
          deltaSanctionsCollectionName
        )
        await fetcher.delta(
          deltaRepo,
          version,
          dayjs(job.parameters.from).toDate()
        )

        await checkSearchIndexesReady(deltaSanctionsCollectionName)
      }
    }

    if (runFullLoad) {
      await client
        .db()
        .collection(sanctionsCollectionName)
        .deleteMany({ version: { $ne: version } })
    }

    // Once lists are updated, run the ongoing screening jobs
    await dispatchOngoingScreeningJobs(tenantId)
  }
}

async function checkSearchIndexesReady(collectionName: string) {
  const client = await getMongoDbClient()
  await client.connect()
  const db = client.db()
  const collection = db.collection(collectionName)
  // Retrieve all search indexes using the $listSearchIndexes aggregation stage
  await backOff(async () => {
    const indexes = await collection
      .aggregate([{ $listSearchIndexes: {} }])
      .toArray()
    for (const index of indexes) {
      // Check if the index is ready
      if (index.status !== 'READY' || !index.queryable) {
        throw new Error('Indexes not ready')
      }
    }
  })
}

async function dispatchOngoingScreeningJobs(tenantId: string) {
  const mongoDB = await getMongoDbClient()
  const users = mongoDB
    ?.db()
    .collection<InternalUser>(USERS_COLLECTION(tenantId as string))
  if (!users) {
    return
  }
  const totalDocs = await users.estimatedDocumentCount()
  const batchSize = 250_000
  const numberOfJobs = Math.ceil(totalDocs / batchSize)
  logger.warn(`${totalDocs} users for screening`)
  logger.warn(`Creating batches of ${batchSize} size`)
  const froms = (
    await Promise.all(
      range(numberOfJobs).map(async (i): Promise<string | null> => {
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
  for (let i = 0; i < froms.length; i++) {
    const from = froms[i]
    const to = froms[i + 1] || undefined // Use `null` as `to` for the last batch

    logger.warn(`Sending batch job #${i}`)
    await sendBatchJobCommand({
      type: 'ONGOING_SCREENING_USER_RULE',
      tenantId: tenantId,
      from,
      to,
    })
  }
}

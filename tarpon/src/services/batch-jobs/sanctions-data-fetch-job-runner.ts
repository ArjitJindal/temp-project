import { range } from 'lodash'
import { backOff } from 'exponential-backoff'
import { MongoClient } from 'mongodb'
import { BatchJobRunner } from './batch-job-runner-base'
import { SanctionsDataFetchBatchJob } from '@/@types/batch-job'
import { sanctionsDataFetchers } from '@/services/sanctions/data-fetchers'
import { MongoSanctionsRepository } from '@/services/sanctions/repositories/sanctions-repository'
import dayjs from '@/utils/dayjs'
import { logger } from '@/core/logger'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import {
  DELTA_SANCTIONS_COLLECTION,
  getSearchIndexName,
  SANCTIONS_COLLECTION,
} from '@/utils/mongodb-definitions'
import {
  createMongoDBCollections,
  getMongoDbClient,
} from '@/utils/mongodb-utils'

export class SanctionsDataFetchBatchJobRunner extends BatchJobRunner {
  protected async run(job: SanctionsDataFetchBatchJob): Promise<void> {
    const client = await getMongoDbClient()
    await runSanctionsDataFetchJob(job, client)
    // Once lists are updated, run the ongoing screening jobs'
    if (job.parameters.from) {
      await dispatchOngoingScreeningJobs(job.tenantId, client)
    }
  }
}

export async function runSanctionsDataFetchJob(
  job: SanctionsDataFetchBatchJob,
  client: MongoClient
) {
  const { tenantId, providers, settings } = job
  const fetchers = await sanctionsDataFetchers(tenantId, providers, settings)
  const runFullLoad = job.parameters?.from
    ? new Date(job.parameters.from).getDay() === 0
    : true
  const version = Date.now().toString()
  logger.info(`Running ${runFullLoad ? 'full' : 'delta'} load`)
  const sanctionsCollectionName = SANCTIONS_COLLECTION(tenantId)
  const deltaSanctionsCollectionName = DELTA_SANCTIONS_COLLECTION(tenantId)
  await createMongoDBCollections(client, tenantId)
  await client.db().collection(deltaSanctionsCollectionName).deleteMany({})
  for (const fetcher of fetchers) {
    logger.info(`Running ${fetcher.constructor.name}`)
    if (runFullLoad) {
      const repo = new MongoSanctionsRepository(sanctionsCollectionName)
      await fetcher.fullLoad(repo, version)
      await checkSearchIndexesReady(sanctionsCollectionName)
    }

    const repo = new MongoSanctionsRepository(sanctionsCollectionName)
    await fetcher.delta(repo, version, dayjs(job.parameters.from).toDate())

    const deltaRepo = new MongoSanctionsRepository(deltaSanctionsCollectionName)
    await fetcher.delta(deltaRepo, version, dayjs(job.parameters.from).toDate())

    await checkSearchIndexesReady(deltaSanctionsCollectionName)
  }

  if (runFullLoad) {
    await client
      .db()
      .collection(sanctionsCollectionName)
      .deleteMany({ version: { $ne: version } })
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
      .aggregate([
        {
          $listSearchIndexes: {
            name: getSearchIndexName(collectionName),
          },
        },
      ])
      .toArray()
    for (const index of indexes) {
      // Check if the index is ready
      if (index.status !== 'READY' || !index.queryable) {
        throw new Error('Indexes not ready')
      }
    }
  })
}

function getFiltersForScreening(tenantId: string) {
  const defaultFilter = {
    sanctionsSearchTypes: {
      $ne: [],
    },
  }
  const filters = {
    pnb: {
      nationality: {
        $in: ['MY', null],
      },
    },
  }
  return {
    ...defaultFilter,
    ...(filters[tenantId] ?? {}),
  }
}

async function dispatchOngoingScreeningJobs(
  tenantId: string,
  mongoDB: MongoClient
) {
  const deltaCollection = mongoDB
    .db()
    .collection(DELTA_SANCTIONS_COLLECTION(tenantId as string))

  if (!deltaCollection) {
    return
  }
  const filters = getFiltersForScreening(tenantId)
  const totalDocs = await deltaCollection.countDocuments(filters)
  const batchSize = 10_000
  const numberOfJobs = Math.ceil(totalDocs / batchSize)
  logger.info(`${totalDocs} users for screening`)
  logger.info(`Creating batches of ${batchSize} size`)
  const froms = (
    await Promise.all(
      range(numberOfJobs).map(async (i): Promise<string | null> => {
        const entity = (
          await deltaCollection
            .find(filters)
            .sort({ id: 1 })
            .skip(i * batchSize)
            .limit(1)
            .toArray()
        )[0]

        if (entity) {
          return entity.id
        }
        return null
      })
    )
  ).filter((p): p is string => Boolean(p))

  if (numberOfJobs === 0) {
    logger.info('Cursors: No users to screen, still running it once')
    await sendBatchJobCommand({
      type: 'ONGOING_SCREENING_USER_RULE',
      tenantId: tenantId,
      from: '0',
      to: '0',
    })
    return
  }

  for (let i = 0; i < froms.length; i++) {
    const from = froms[i]
    const to = froms[i + 1] || undefined // Use `null` as `to` for the last batch

    logger.info(`Sending batch job #${i}`)
    await sendBatchJobCommand({
      type: 'ONGOING_SCREENING_USER_RULE',
      tenantId: tenantId,
      from,
      to,
    })
  }
}

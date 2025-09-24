import range from 'lodash/range'
import uniq from 'lodash/uniq'
import { backOff } from 'exponential-backoff'
import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { Client } from '@opensearch-project/opensearch/.'
import { getSanctionsCollectionName } from '../sanctions/utils'
import { BatchJobRunner } from './batch-job-runner-base'
import { runScreeningProfileDataFetcherBatchJob } from './screening-profile-data-fetcher'
import { DeltaSanctionsDataFetchBatchJob } from '@/@types/batch-job'
import { sanctionsDataFetcher } from '@/services/sanctions/data-fetchers'
import { MongoSanctionsRepository } from '@/services/sanctions/repositories/sanctions-repository'
import dayjs from '@/utils/dayjs'
import { logger } from '@/core/logger'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { getSearchIndexName } from '@/utils/mongodb-definitions'
import {
  createGlobalMongoDBCollections,
  createMongoDBCollections,
  getMongoDbClient,
} from '@/utils/mongodb-utils'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import {
  deleteDocumentsByVersion,
  deleteIndexAfterDataLoad,
  getOpensearchClient,
  isOpensearchAvailableInRegion,
  syncOpensearchIndex,
} from '@/utils/opensearch-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'

export class DeltaSanctionsDataFetchBatchJobRunner extends BatchJobRunner {
  protected async run(job: DeltaSanctionsDataFetchBatchJob): Promise<void> {
    const client = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const openSearchClient = isOpensearchAvailableInRegion()
      ? await getOpensearchClient()
      : undefined
    await runDeltaSanctionsDataFetchJob(job, client, dynamoDb, openSearchClient)
    if (openSearchClient) {
      await Promise.all([
        runScreeningProfileDataFetcherBatchJob(
          dynamoDb,
          client,
          openSearchClient,
          {
            provider: job.providers[0],
            type: 'delta',
          }
        ),
      ])
    }
    // Once lists are updated, run the ongoing screening jobs'
    if (job.parameters.from && job.parameters.ongoingScreeningTenantIds) {
      const tenantIds = job.parameters.ongoingScreeningTenantIds
      await Promise.all(
        tenantIds.map((id) => {
          return dispatchOngoingScreeningJobs(id, client, job.providers)
        })
      )
    }
  }
}

export async function runDeltaSanctionsDataFetchJob(
  job: DeltaSanctionsDataFetchBatchJob,
  client: MongoClient,
  dynamoDb: DynamoDBDocumentClient,
  opensearchClient?: Client
) {
  const { tenantId, providers, settings } = job
  const version = Date.now().toString()
  logger.info(`Running delta`)

  const deltaSanctionsCollectionNames = uniq(
    providers.map((p) => {
      return {
        name: getSanctionsCollectionName(
          {
            provider: p,
          },
          tenantId,
          'delta'
        ),
        provider: p,
      }
    })
  )
  await Promise.all([
    createMongoDBCollections(client, dynamoDb, tenantId),
    createGlobalMongoDBCollections(client),
  ])
  await Promise.all([
    ...deltaSanctionsCollectionNames.map((c) =>
      client.db().collection(c.name).deleteMany({})
    ),
    ...deltaSanctionsCollectionNames.map((c) =>
      deleteDocumentsByVersion(opensearchClient, c.name, version)
    ),
  ])

  for (const {
    name: deltaSanctionsCollectionName,
    provider,
  } of deltaSanctionsCollectionNames) {
    const aliasName = await syncOpensearchIndex(
      opensearchClient,
      deltaSanctionsCollectionName
    )
    const fetcher = await sanctionsDataFetcher(
      tenantId,
      provider,
      { mongoDb: client, dynamoDb },
      settings ?? [
        {
          provider,
        },
      ]
    )
    if (!fetcher) {
      continue
    }

    logger.info(`Running delta ${fetcher.constructor.name}`)
    const deltaRepo = new MongoSanctionsRepository(
      deltaSanctionsCollectionName,
      opensearchClient,
      aliasName
    )
    await fetcher.delta(deltaRepo, version, dayjs(job.parameters.from).toDate())
    if (aliasName && opensearchClient) {
      await deleteIndexAfterDataLoad(
        opensearchClient,
        deltaSanctionsCollectionName,
        aliasName
      )
    }
    await checkSearchIndexesReady(deltaSanctionsCollectionName)
  }
}

export async function checkSearchIndexesReady(collectionName: string) {
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

function getFiltersForScreening(
  tenantId: string,
  providers: SanctionsDataProviderName[]
) {
  const defaultFilter = {
    sanctionsSearchTypes: {
      $ne: [],
    },
    provider: {
      $in: providers,
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
  mongoDB: MongoClient,
  providers: SanctionsDataProviderName[]
) {
  const deltaCollection = mongoDB.db().collection(
    getSanctionsCollectionName(
      {
        provider: providers[0],
      },
      tenantId,
      'delta'
    )
  )

  if (!deltaCollection) {
    return
  }
  const filters = getFiltersForScreening(tenantId, providers)
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

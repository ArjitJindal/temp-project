import { stageAndRegion } from '@flagright/lib/utils/env'
import { FlagrightRegion, Stage } from '@flagright/lib/constants/deploy'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { Client } from '@opensearch-project/opensearch/.'
import { TenantService } from '../tenants'
import { ScreeningProfileService } from '../screening-profile'
import { getSanctionsCollectionName } from '../sanctions/utils'
import {
  getAggregatedSourceIds,
  getScreeningProfileData,
} from '../sanctions/providers/utils'
import { TenantRepository } from '../tenants/repositories/tenant-repository'
import { BatchJobRepository } from './repositories/batch-job-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { ScreeningProfileDataFetchBatchJob } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import dayjs from '@/utils/dayjs'
import { logger } from '@/core/logger'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { SanctionsEntityType } from '@/@types/openapi-internal/SanctionsEntityType'
import { ScreeningProfileResponse } from '@/@types/openapi-internal/ScreeningProfileResponse'
import {
  bulkUpdate,
  createIndexIfNotExists,
  deleteByQuery,
  getSharedOpensearchClient,
} from '@/utils/opensearch-utils'
import { SANCTIONS_SEARCH_INDEX_DEFINITION } from '@/utils/opensearch-definitions'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { envIsNot } from '@/utils/env'

export class ScreeningProfileDataFetcherBatchJobRunner extends BatchJobRunner {
  protected async run(job: ScreeningProfileDataFetchBatchJob): Promise<void> {
    const dynamoDb = getDynamoDbClient()
    const client = await getMongoDbClient()
    const batchJobRepository = new BatchJobRepository(job.tenantId, client)
    const existingJobs = await batchJobRepository.getJobs(
      {
        type: job.type,
        tenantId: job.tenantId,
        latestStatus: {
          status: 'IN_PROGRESS',
          latestStatusAfterTimestamp: dayjs().subtract(1, 'day').valueOf(),
        },
        parameters: {
          entityType: job.parameters.entityType,
          type: job.parameters.type,
        },
        jobId: {
          notEqualTo: job['jobId'],
        },
      },
      1
    )
    if (existingJobs.length > 0 && envIsNot('local')) {
      logger.info(
        `Skipping ${job.type} job because it's already running ${existingJobs[0].jobId}`
      )
      return
    }
    const openSearchClient = await getSharedOpensearchClient()
    await runScreeningProfileDataFetcherBatchJob(
      dynamoDb,
      client,
      openSearchClient,
      job.parameters
    )
  }
}

export async function runScreeningProfileDataFetcherBatchJob(
  dynamoDb: DynamoDBDocumentClient,
  client: MongoClient,
  openSearchClient: Client,
  {
    provider,
    entityType,
    type,
    tenantIds,
  }: {
    provider: SanctionsDataProviderName
    entityType?: SanctionsEntityType
    type: 'delta' | 'full'
    tenantIds?: string[]
  }
) {
  const [stage, region] = stageAndRegion() as [Stage, FlagrightRegion]
  const ids = tenantIds
    ? tenantIds
    : (await TenantService.getAllTenants(stage, region)).map((t) => t.tenant.id)
  logger.info(`Found ${ids.length} tenants`)
  for (const tenantId of ids) {
    const tenantRepository = new TenantRepository(tenantId, {
      dynamoDb,
    })
    const settings = await tenantRepository.getTenantSettings()

    if (settings.sanctions?.aggregateScreeningProfileData) {
      logger.info(`Tenant ${tenantId} has aggregateScreeningProfileData`)
      const screeningProfileService = new ScreeningProfileService(tenantId, {
        dynamoDb,
      })
      const { items: screeningProfiles } =
        await screeningProfileService.getScreeningProfiles()
      for (const screeningProfile of screeningProfiles) {
        if (screeningProfile.containAllSources) {
          logger.info(
            `Tenant ${tenantId} screening profile ${screeningProfile.screeningProfileId} has containAllSources`
          )
          continue
        }
        const sanctionsCollectionName = getSanctionsCollectionName(
          {
            provider,
            entityType,
          },
          tenantId,
          type,
          {
            aggregate: true,
            screeningProfileId: screeningProfile.screeningProfileId,
            screeningProfileContainsAllSources:
              screeningProfile.containAllSources,
          }
        )
        const sourceCollectionName = getSanctionsCollectionName(
          {
            provider,
            entityType,
          },
          tenantId,
          type
        )
        if (sanctionsCollectionName === sourceCollectionName) {
          logger.info(
            `Skipping ${sanctionsCollectionName} because it's the same as source collection`
          )
          continue
        }
        logger.info(`Creating index ${sanctionsCollectionName}`)
        logger.info(sourceCollectionName)
        await createIndexIfNotExists(
          openSearchClient,
          sanctionsCollectionName,
          SANCTIONS_SEARCH_INDEX_DEFINITION({
            aliasName: sanctionsCollectionName,
            provider,
            aggregatedIndex: true,
          })
        )
        await fillScreeningProfileData({
          screeningProfile,
          sourceCollectionName,
          sanctionsCollectionName,
          provider,
          openSearchClient,
        })
      }
    }
  }
}

async function fillScreeningProfileData({
  screeningProfile,
  sourceCollectionName,
  sanctionsCollectionName,
  openSearchClient,
  provider,
}: {
  screeningProfile: ScreeningProfileResponse
  sourceCollectionName: string
  sanctionsCollectionName: string
  openSearchClient: Client
  provider: SanctionsDataProviderName
}) {
  const version = Date.now().toString()
  const data = getScreeningProfileData(screeningProfile)
  const allSourceIds = getAggregatedSourceIds(data)
  logger.info(`Deleting documents from ${sanctionsCollectionName}`)
  await deleteByQuery(openSearchClient, sanctionsCollectionName, {
    query: {
      bool: {
        must_not: {
          terms: {
            aggregatedSourceIds: allSourceIds,
          },
        },
      },
    },
  })
  logger.info(`Deleted documents from ${sanctionsCollectionName} done`)
  const query = {
    bool: {
      must: [
        {
          terms: {
            aggregatedSourceIds: allSourceIds,
          },
        },
      ],
    },
  }
  let searchAfter: string | undefined = undefined
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await openSearchClient.search({
      index: sourceCollectionName,
      size: 1000,
      body: {
        query,
        sort: ['_id'],
        ...(searchAfter ? { search_after: [searchAfter] } : {}),
      },
    })
    const hits = response.body.hits.hits.map(
      (h) => h._source
    ) as SanctionsEntity[]
    if (hits.length === 0) {
      break
    }
    searchAfter = hits[hits.length - 1].id
    await bulkUpdate(
      provider,
      hits?.map((hit) => ['chg', hit]),
      version,
      sanctionsCollectionName,
      openSearchClient
    )
    logger.info('Aggregated ', hits.length, ' entities')
  }
}

import { MongoClient } from 'mongodb'
import { getSanctionsCollectionName } from '../sanctions/utils'
import { SanctionsDataProviders } from '../sanctions/types'
import { BatchJobRunner } from './batch-job-runner-base'
import { BatchJobRepository } from './repositories/batch-job-repository'
import { SanctionsDataFetchBatchJob } from '@/@types/batch-job'
import { sanctionsDataFetcher } from '@/services/sanctions/data-fetchers'
import { MongoSanctionsRepository } from '@/services/sanctions/repositories/sanctions-repository'
import dayjs from '@/utils/dayjs'
import { logger } from '@/core/logger'
import {
  createGlobalMongoDBCollections,
  createMongoDBCollections,
  getMongoDbClient,
} from '@/utils/mongodb-utils'
import { getOpensearchClient } from '@/utils/opensearch-utils'
import { envIsNot } from '@/utils/env'

export class SanctionsDataFetchBatchJobRunner extends BatchJobRunner {
  protected async run(job: SanctionsDataFetchBatchJob): Promise<void> {
    const client = await getMongoDbClient()
    const batchJobRepository = new BatchJobRepository(job.tenantId, client)
    const existingJobs = await batchJobRepository.getJobs(
      {
        type: job.type,
        tenantId: job.tenantId,
        'latestStatus.status': 'IN_PROGRESS',
        'latestStatus.timestamp': {
          $gt: dayjs().subtract(1, 'day').millisecond(),
        },
        providers: job.providers,
        parameters: {
          entityType: job.parameters.entityType,
        },
      },
      1
    )
    if (existingJobs.length > 0) {
      logger.info(
        `Skipping ${job.type} job because it's already running ${existingJobs[0].jobId}`
      )
      return
    }
    await runSanctionsDataFetchJob(job, client)
  }
}

export async function runSanctionsDataFetchJob(
  job: SanctionsDataFetchBatchJob,
  client: MongoClient
) {
  const { tenantId, providers, settings } = job
  const opensearchClient = envIsNot('prod')
    ? await getOpensearchClient()
    : undefined
  const runFullLoad = job.parameters?.from
    ? new Date(job.parameters.from).getDay() === 0
    : true
  const version = Date.now().toString()
  logger.info(`Running full load`)
  for (const provider of providers) {
    const fetcher = await sanctionsDataFetcher(
      tenantId,
      provider,
      settings ?? [
        {
          provider,
        },
      ]
    )
    if (!fetcher) {
      continue
    }
    const sanctionsCollectionName = getSanctionsCollectionName(
      {
        provider,
        entityType: job.parameters.entityType,
      },
      tenantId,
      'full'
    )
    await Promise.all([
      createMongoDBCollections(client, tenantId),
      createGlobalMongoDBCollections(client),
    ])

    logger.info(`Running ${fetcher.constructor.name}`)
    if (runFullLoad) {
      const repo = new MongoSanctionsRepository(
        sanctionsCollectionName,
        opensearchClient
      )
      await fetcher.fullLoad(repo, version, job.parameters.entityType)
    }

    const repo = new MongoSanctionsRepository(
      sanctionsCollectionName,
      opensearchClient
    )
    if (provider !== SanctionsDataProviders.ACURIS || runFullLoad) {
      // To avoid fetching delta for Acuris daily separately, instead it's fetched in delta load
      await fetcher.delta(
        repo,
        version,
        dayjs(job.parameters.from).toDate(),
        job.parameters.entityType,
        runFullLoad
      )
    }

    if (runFullLoad) {
      await client
        .db()
        .collection(sanctionsCollectionName)
        .deleteMany({ version: { $ne: version } })
    }
  }
}

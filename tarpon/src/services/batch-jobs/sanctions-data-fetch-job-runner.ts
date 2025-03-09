import { MongoClient } from 'mongodb'
import { getSanctionsCollectionName } from '../sanctions/utils'
import { BatchJobRunner } from './batch-job-runner-base'
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

export class SanctionsDataFetchBatchJobRunner extends BatchJobRunner {
  protected async run(job: SanctionsDataFetchBatchJob): Promise<void> {
    const client = await getMongoDbClient()
    await runSanctionsDataFetchJob(job, client)
  }
}

export async function runSanctionsDataFetchJob(
  job: SanctionsDataFetchBatchJob,
  client: MongoClient
) {
  const { tenantId, providers, settings } = job
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
      const repo = new MongoSanctionsRepository(sanctionsCollectionName)
      await fetcher.fullLoad(repo, version, job.parameters.entityType)
    }

    const repo = new MongoSanctionsRepository(sanctionsCollectionName)
    await fetcher.delta(
      repo,
      version,
      dayjs(job.parameters.from).toDate(),
      job.parameters.entityType
    )

    if (runFullLoad) {
      await client
        .db()
        .collection(sanctionsCollectionName)
        .deleteMany({ version: { $ne: version } })
    }
  }
}

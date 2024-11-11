import { FlagrightRegion, Stage } from '@flagright/lib/constants/deploy'
import { backOff } from 'exponential-backoff'
import { BatchJobRunner } from './batch-job-runner-base'
import { SanctionsDataFetchBatchJob } from '@/@types/batch-job'
import { sanctionsDataFetchers } from '@/services/sanctions/data-fetchers'
import { MongoSanctionsRepository } from '@/services/sanctions/repositories/sanctions-repository'
import dayjs from '@/utils/dayjs'
import { logger } from '@/core/logger'
import { TenantService } from '@/services/tenants'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import {
  NEW_SANCTIONS_COLLECTION,
  OLD_SANCTIONS_COLLECTION,
  SANCTIONS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export class SanctionsDataFetchBatchJobRunner extends BatchJobRunner {
  protected async run(job: SanctionsDataFetchBatchJob): Promise<void> {
    const fetchers = await sanctionsDataFetchers()
    const runFullLoad = job.parameters?.from
      ? new Date(job.parameters.from).getDay() === 0
      : true
    const version = job.parameters?.from
      ? dayjs(job.parameters.from).format('YYYY-MM')
      : dayjs().format('YYYY-MM')
    logger.info(`Running ${runFullLoad ? 'full' : 'delta'} load`)

    for (const fetcher of fetchers) {
      logger.info(`Running ${fetcher.constructor.name}`)
      if (runFullLoad) {
        const repo = new MongoSanctionsRepository(NEW_SANCTIONS_COLLECTION)
        await fetcher.fullLoad(repo, version)
      } else {
        const repo = new MongoSanctionsRepository(SANCTIONS_COLLECTION)
        await fetcher.delta(repo, version, dayjs(job.parameters.from).toDate())
      }
    }

    if (runFullLoad) {
      await backOff(() => checkSearchIndexesReady(NEW_SANCTIONS_COLLECTION), {
        numOfAttempts: 10,
        maxDelay: 10000,
        startingDelay: 1000,
        jitter: 'full',
      })

      const client = await getMongoDbClient()
      const session = client.startSession()
      session.startTransaction()

      await client.db().dropCollection(OLD_SANCTIONS_COLLECTION)
      await client
        .db()
        .renameCollection(SANCTIONS_COLLECTION, OLD_SANCTIONS_COLLECTION)
      await client
        .db()
        .renameCollection(NEW_SANCTIONS_COLLECTION, SANCTIONS_COLLECTION)

      await session.commitTransaction()
      await session.endSession()
    }

    if (runFullLoad) {
      for (const fetcher of fetchers) {
        await fetcher.updateMonitoredSearches()

        const tenantInfos = await TenantService.getAllTenants(
          process.env.ENV as Stage,
          process.env.REGION as FlagrightRegion
        )

        // Once lists are updated, run the ongoing screening jobs
        for await (const tenant of tenantInfos) {
          const tenantId = tenant.tenant.id

          if (tenant.tenant.name.toLowerCase().indexOf('pnb') > -1) {
            // TODO: disabled until scalability sorted
            // await sendBatchJobCommand({
            //   type: 'PNB_SCREENING_BACKFILL',
            //   tenantId,
            // })
          } else {
            await sendBatchJobCommand({
              type: 'ONGOING_SCREENING_USER_RULE',
              tenantId,
            })
          }
        }
      }
    }
  }
}

async function checkSearchIndexesReady(collectionName: string) {
  const client = await getMongoDbClient()
  await client.connect()
  const db = client.db()
  const collection = db.collection(collectionName)

  // Retrieve all search indexes using the $listSearchIndexes aggregation stage
  const indexes = await collection
    .aggregate([{ $listSearchIndexes: {} }])
    .toArray()

  for (const index of indexes) {
    // Check if the index is ready
    if (index.status !== 'READY' || !index.queryable) {
      throw new Error('Indexes not ready')
    }
  }
}

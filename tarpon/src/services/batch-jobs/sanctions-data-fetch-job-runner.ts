import { FlagrightRegion, Stage } from '@flagright/lib/constants/deploy'
import { BatchJobRunner } from './batch-job-runner-base'
import { SanctionsDataFetchBatchJob } from '@/@types/batch-job'
import { sanctionsDataFetchers } from '@/services/sanctions/data-fetchers'
import { MongoSanctionsRepository } from '@/services/sanctions/repositories/sanctions-repository'
import dayjs from '@/utils/dayjs'
import { logger } from '@/core/logger'
import { TenantService } from '@/services/tenants'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { SANCTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import {
  createGlobalMongoDBCollections,
  getMongoDbClient,
} from '@/utils/mongodb-utils'

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
    const client = await getMongoDbClient()

    for (const fetcher of fetchers) {
      logger.info(`Running ${fetcher.constructor.name}`)
      if (runFullLoad) {
        await createGlobalMongoDBCollections(client)
        const repo = new MongoSanctionsRepository(sanctionsCollectionName)
        await fetcher.fullLoad(repo, version)
      } else {
        const repo = new MongoSanctionsRepository(sanctionsCollectionName)
        await fetcher.delta(repo, version, dayjs(job.parameters.from).toDate())
      }
    }

    if (runFullLoad) {
      await client
        .db()
        .collection(sanctionsCollectionName)
        .deleteMany({ version: { $ne: version } })
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
          await sendBatchJobCommand({
            type: 'ONGOING_SCREENING_USER_RULE',
            tenantId,
          })
        }
      }
    }
  }
}

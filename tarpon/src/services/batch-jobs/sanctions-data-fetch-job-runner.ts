import { FlagrightRegion, Stage } from '@flagright/lib/constants/deploy'
import { BatchJobRunner } from './batch-job-runner-base'
import { SanctionsDataFetchBatchJob } from '@/@types/batch-job'
import { sanctionsDataFetchers } from '@/services/sanctions/data-fetchers'
import { MongoSanctionsRepository } from '@/services/sanctions/repositories/sanctions-repository'
import dayjs from '@/utils/dayjs'
import { logger } from '@/core/logger'
import { TenantService } from '@/services/tenants'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'

export class SanctionsDataFetchBatchJobRunner extends BatchJobRunner {
  protected async run(job: SanctionsDataFetchBatchJob): Promise<void> {
    const fetchers = await sanctionsDataFetchers()
    const repo = new MongoSanctionsRepository()
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
        await fetcher.fullLoad(repo, version)
      } else {
        await fetcher.delta(repo, version, dayjs(job.parameters.from).toDate())
      }
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

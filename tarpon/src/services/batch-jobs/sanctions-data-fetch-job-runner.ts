import { BatchJobRunner } from './batch-job-runner-base'
import { SanctionsDataFetchBatchJob } from '@/@types/batch-job'
import { sanctionsDataFetchers } from '@/services/sanctions/data-fetchers'
import { MongoSanctionsRepository } from '@/services/sanctions/repositories/sanctions-repository'
import dayjs from '@/utils/dayjs'
import { logger } from '@/core/logger'

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
    }
  }
}

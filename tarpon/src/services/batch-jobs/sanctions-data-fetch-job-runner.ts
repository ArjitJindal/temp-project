import { BatchJobRunner } from './batch-job-runner-base'
import { SanctionsDataFetchBatchJob } from '@/@types/batch-job'
import { sanctionsDataFetchers } from '@/services/sanctions/data-fetchers'
import { MongoSanctionsRepository } from '@/services/sanctions/repositories/sanctions-repository'
import dayjs from '@/utils/dayjs'

export class SanctionsDataFetchBatchJobRunner extends BatchJobRunner {
  protected async run(job: SanctionsDataFetchBatchJob): Promise<void> {
    const fetchers = await sanctionsDataFetchers()
    const repo = new MongoSanctionsRepository()
    const today = new Date(job.parameters.from)
    for (const fetcher of fetchers) {
      if (today.getDay() === 0) {
        await fetcher.fullLoad(repo)
      } else {
        await fetcher.delta(repo, dayjs(job.parameters.from).toDate())
      }
    }
  }
}

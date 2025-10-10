import { BatchJobRunner } from './batch-job-runner-base'
import { PnbBackfillTransactionsBatchJobRunner } from './pnb-backfill-transactions-fargate-batch-job'
import { PnbBackfillArs } from '@/@types/batch-job'

export class PnbBackfillArsBatchJobRunner extends BatchJobRunner {
  protected async run(job: PnbBackfillArs & { jobId: string }): Promise<void> {
    await new PnbBackfillTransactionsBatchJobRunner(job.jobId).run(
      {
        ...job,
        type: 'PNB_BACKFILL_TRANSACTIONS',
      },
      'ars'
    )
  }
}

import { cleanUpStaleQaEnvs } from '@lib/qa-cleanup'
import { BatchJobRunner } from './batch-job-runner-base'

export class QACleanupBatchJobRunner extends BatchJobRunner {
  protected async run(): Promise<void> {
    await cleanUpStaleQaEnvs()
  }
}

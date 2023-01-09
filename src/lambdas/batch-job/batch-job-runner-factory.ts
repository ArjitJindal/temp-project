import { FileImportBatchJobRunner } from './file-import-batch-job-runner'
import { PlaceholderBatchJobRunner } from './placeholder-batch-job-runner'
import { BatchJobRunner } from './batch-job-runner-base'
import { LiveTestingPulseBatchJobRunner } from './live-testing-pulse-batch-job-runner'
import { BatchJobType } from '@/@types/batch-job'
import { logger } from '@/core/logger'

export class BatchJobRunnerFactory {
  public static getBatchJobRunner(type: BatchJobType): BatchJobRunner {
    switch (type) {
      case 'FILE_IMPORT':
        return new FileImportBatchJobRunner()
      case 'LIVE_TESTING_PULSE':
        return new LiveTestingPulseBatchJobRunner()
      default: {
        logger.warn(`Unknown batch job type ${type}. Do nothing.`)
        return new PlaceholderBatchJobRunner()
      }
    }
  }
}

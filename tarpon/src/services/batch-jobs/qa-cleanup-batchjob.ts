import { cleanUpStaleQaEnvs } from '@lib/qa-cleanup'
import { BatchJobRunner } from './batch-job-runner-base'
import { withTimeout } from '@/utils/object'
import { logger } from '@/core/logger'

export class QACleanupBatchJobRunner extends BatchJobRunner {
  protected async run(): Promise<void> {
    try {
      await withTimeout(cleanUpStaleQaEnvs(), 1000 * 60 * 12) // 12 minutes
    } catch (e) {
      logger.warn('Timeout in cleaning up stale QA Envs', e)
    }
  }
}

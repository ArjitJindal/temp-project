import { BatchJobRunner } from './batch-job-runner-base'
import { BatchJob } from '@/@types/batch-job'

export class FailingBatchJobRunner extends BatchJobRunner {
  protected async run(_job: BatchJob): Promise<void> {
    // This job always fails by throwing an error after 30 seconds
    await new Promise((resolve) => setTimeout(resolve, 30000))
    throw new Error('This batch job is designed to fail for testing purposes')
  }
}

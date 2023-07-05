import { BatchJobRunner } from './batch-job-runner-base'

export class PlaceholderBatchJobRunner extends BatchJobRunner {
  public async run() {
    return 'PLACEHOLDER_JOB_OUTPUT'
  }
}

import { BatchJobRunner } from './batch-job-runner-base'

export class PlaceholderBatchJobRunner implements BatchJobRunner {
  public async run() {
    return 'PLACEHOLDER_JOB_OUTPUT'
  }
}

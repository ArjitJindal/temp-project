import { BatchJob } from '@/@types/batch-job'

export abstract class BatchJobRunner {
  protected abstract run(job: BatchJob): Promise<void>
  public async execute(job: BatchJob): Promise<void> {
    return this.run(job)
  }
}

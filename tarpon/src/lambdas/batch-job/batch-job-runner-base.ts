import { BatchJob } from '@/@types/batch-job'

export abstract class BatchJobRunner {
  protected abstract run(job: BatchJob): Promise<any>
  public async execute(job: BatchJob): Promise<any> {
    return this.run(job)
  }
}

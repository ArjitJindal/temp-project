import { BatchJob } from '@/@types/batch-job'

export abstract class BatchJobRunner {
  public abstract run(job: BatchJob): Promise<any>
}

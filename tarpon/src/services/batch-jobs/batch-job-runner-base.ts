import { BatchJobRepository } from './repositories/batch-job-repository'
import { BatchJob } from '@/@types/batch-job'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export abstract class BatchJobRunner {
  protected jobId: string
  protected jobRepository: BatchJobRepository
  constructor(jobId: string) {
    this.jobId = jobId
    this.jobRepository = null as any
  }
  protected abstract run(job: BatchJob): Promise<void>
  public async execute(job: BatchJob): Promise<void> {
    this.jobRepository = new BatchJobRepository(
      job.tenantId,
      await getMongoDbClient()
    )
    return this.run(job)
  }
}

import { MongoError } from 'mongodb'
import { BatchJobRepository } from './repositories/batch-job-repository'
import { BatchJob } from '@/@types/batch-job'
import { logger } from '@/core/logger'
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

    for (let i = 0; i < 10; i++) {
      try {
        await this.run(job)
        return
      } catch (error) {
        // Ref: https://www.mongodb.com/docs/manual/reference/error-codes/
        if ((error as MongoError).code === 43) {
          logger.warn(`Cursor expired, retrying... ${i}`)
          continue
        }
        throw error
      }
    }
  }
}

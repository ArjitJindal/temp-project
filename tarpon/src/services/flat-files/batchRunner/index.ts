import { v4 as uuid4 } from 'uuid'
import pMap from 'p-map'
import { FlatFileBaseRunner } from '../baseRunner'
import { FlatFilesRecordsSchema } from '@/@types/flat-files'
import { logger } from '@/core/logger'
import { EntityModel } from '@/@types/model'

export abstract class FlatFileBatchRunner<
  T extends EntityModel | { [key: string]: string }
> extends FlatFileBaseRunner<T> {
  protected abstract batchRun(
    batchId: string,
    records: Array<{
      data: T
      schema: FlatFilesRecordsSchema
    }>,
    metadata?: object
  ): Promise<void>

  protected async processBatch(
    batch: Array<FlatFilesRecordsSchema>,
    metadata: object
  ): Promise<void> {
    logger.info(`Starting processing of new batch`)
    const sanitizedBatch: {
      data: T
      schema: FlatFilesRecordsSchema
    }[] = (
      await pMap(batch, (record) => this.sanitizeRecord(record), {
        concurrency: this.concurrency,
      })
    ).filter(
      (r): r is { data: T; schema: FlatFilesRecordsSchema } => r !== undefined
    )
    const batchId = uuid4()
    await this.batchRun(batchId, sanitizedBatch, metadata)
    logger.info(`Processed ${batch.length} records`)
  }
}

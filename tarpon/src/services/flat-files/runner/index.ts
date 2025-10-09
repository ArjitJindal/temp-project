import omit from 'lodash/omit'
import pMap from 'p-map'
import { FlatFileBaseRunner } from '../baseRunner'
import { EntityModel } from '@/@types/model'
import { FlatFilesRecordsSchema } from '@/@types/flat-files'
import { logger } from '@/core/logger'

export abstract class FlatFileRunner<
  T extends EntityModel | { [key: string]: string }
> extends FlatFileBaseRunner<T> {
  protected abstract _run(
    data: T,
    recordMetaData: Omit<FlatFilesRecordsSchema, 'parsedRecord'>,
    metadata?: object
  ): Promise<void>

  private async processRecord(
    recordPayload: {
      data: T
      schema: FlatFilesRecordsSchema
    },
    metadata: object
  ): Promise<void> {
    const { data, schema } = recordPayload
    const recordId = `${schema.fileId}:${schema.row}`
    logger.info(`Starting to process record ${recordId}`)

    try {
      // Skip if already has errors
      if (schema.error?.length > 0) {
        logger.info(`Skipping record ${recordId} due to existing errors`)
        await this.updateRecordStatus(schema, true)
        return
      }
      await this._run(data, omit(schema, ['parsedRecord']), metadata)

      // Update successful record
      await this.updateRecordStatus(schema, true)
      logger.info(`Successfully processed record ${recordId}`)
    } catch (error: unknown) {
      // Handle and log the error
      const errorDetails = this.formatError(error)
      logger.error(`Failed to process record ${recordId}`, {
        error: errorDetails,
        recordId,
        fileId: schema.fileId,
        row: schema.row,
      })

      // Update failed record
      await this.updateRecordStatus(schema, true, [errorDetails])
    }
  }

  protected async processBatch(
    batch: Array<FlatFilesRecordsSchema>,
    metadata: object
  ): Promise<void> {
    const sanitizedBatch = (
      await pMap(
        batch,
        async (record) => {
          const sanitized = await this.sanitizeRecord(record)
          if (sanitized) {
            return sanitized
          }
        },
        { concurrency: this.concurrency }
      )
    ).filter(
      (v): v is { data: T; schema: FlatFilesRecordsSchema } => v !== undefined
    )
    await Promise.all(
      sanitizedBatch.map((record) => this.processRecord(record, metadata))
    )

    logger.info(`Processed ${batch.length} records`)
  }
}

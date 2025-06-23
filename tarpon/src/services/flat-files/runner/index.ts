import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { ClickHouseClient } from '@clickhouse/client'
import { omit } from 'lodash'
import { MongoClient } from 'mongodb'
import { ConnectionCredentials } from 'thunder-schema'
import pMap from 'p-map'
import { FlatFilesRecords } from '@/models/flat-files-records'
import { EntityModel } from '@/@types/model'
import {
  FlatFilesRecordsSchema,
  FlatFileValidationResult,
  FlatFilesRecordsError,
} from '@/@types/flat-files'
import { logger } from '@/core/logger'

export abstract class FlatFileRunner<
  T extends EntityModel | { [key: string]: string }
> {
  protected readonly tenantId: string
  protected readonly dynamoDb: DynamoDBDocumentClient
  protected readonly mongoDb: MongoClient
  protected readonly clickhouseClient: ClickHouseClient
  protected readonly clickhouseConnectionConfig: ConnectionCredentials

  constructor(
    tenantId: string,
    connections?: {
      dynamoDb: DynamoDBDocumentClient
      mongoDb: MongoClient
      clickhouseClient: ClickHouseClient
      clickhouseConnectionConfig: ConnectionCredentials
    }
  ) {
    this.tenantId = tenantId
    this.dynamoDb = connections?.dynamoDb as DynamoDBDocumentClient
    this.mongoDb = connections?.mongoDb as MongoClient
    this.clickhouseClient = connections?.clickhouseClient as ClickHouseClient
    this.clickhouseConnectionConfig =
      connections?.clickhouseConnectionConfig as ConnectionCredentials
  }

  public abstract concurrency: number
  public abstract model: EntityModel | ((metadata: object) => EntityModel)

  abstract validate(
    data: T,
    metadata?: object
  ): Promise<Pick<FlatFileValidationResult, 'valid' | 'errors'>>

  protected abstract _run(
    data: T,
    recordMetaData: Omit<FlatFilesRecordsSchema, 'parsedRecord'>,
    metadata?: object
  ): Promise<void>

  private async processRecord(
    record: FlatFilesRecordsSchema,
    metadata: object
  ): Promise<void> {
    const updateRecordInstance = new FlatFilesRecords({
      credentials: this.clickhouseConnectionConfig,
    })

    const recordId = `${record.fileId}:${record.row}`
    logger.info(`Starting to process record ${recordId}`)

    try {
      // Skip if already has errors
      if (record.error?.length > 0) {
        logger.info(`Skipping record ${recordId} due to existing errors`)
        await this.updateRecordStatus(updateRecordInstance, record, true)
        return
      }

      // Parse and validate the record
      const data = this.parseRecord(record)
      await this._run(data, omit(record, ['parsedRecord']), metadata)

      // Update successful record
      await this.updateRecordStatus(updateRecordInstance, record, true)
      logger.info(`Successfully processed record ${recordId}`)
    } catch (error: unknown) {
      // Handle and log the error
      const errorDetails = this.formatError(error)
      logger.error(`Failed to process record ${recordId}`, {
        error: errorDetails,
        recordId,
        fileId: record.fileId,
        row: record.row,
      })

      // Update failed record
      await this.updateRecordStatus(updateRecordInstance, record, true, [
        errorDetails,
      ])
    }
  }

  private parseRecord(record: FlatFilesRecordsSchema): T {
    try {
      return JSON.parse(record.initialRecord) as T
    } catch (error) {
      throw new Error(
        `Failed to parse record: ${
          error instanceof Error ? error.message : 'Unknown parsing error'
        }`
      )
    }
  }

  private formatError(error: unknown): FlatFilesRecordsError {
    return {
      keyword: error instanceof Error ? error.name : 'unknown',
      message: error instanceof Error ? error.message : 'unknown',
      stage: 'RUNNER',
    }
  }

  protected async updateRecordStatus(
    updateRecordInstance: FlatFilesRecords,
    record: FlatFilesRecordsSchema,
    isProcessed: boolean,
    errors?: FlatFilesRecordsError[]
  ): Promise<void> {
    await updateRecordInstance
      .create({
        ...record,
        isProcessed,
        updatedAt: Date.now(),
        error: errors || record.error,
      })
      .save()
  }

  private async processBatch(
    batch: Array<FlatFilesRecordsSchema>,
    metadata: object
  ): Promise<void> {
    await pMap(batch, (record) => this.processRecord(record, metadata), {
      concurrency: this.concurrency,
    })

    logger.info(`Processed ${batch.length} records`)
  }

  public async run(metadata: object): Promise<void> {
    const flatFilesRecords = new FlatFilesRecords({
      credentials: this.clickhouseConnectionConfig,
    })
    const stream = flatFilesRecords.objects
    const batchSize = this.concurrency * 10
    let currentBatch: Array<FlatFilesRecordsSchema> = []

    for await (const record of stream) {
      currentBatch.push(record)

      if (currentBatch.length >= batchSize) {
        await this.processBatch(currentBatch, metadata)
        currentBatch = []
      }
    }

    // Process remaining records
    if (currentBatch.length > 0) {
      await this.processBatch(currentBatch, metadata)
    }
  }
}

import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { ClickHouseClient } from '@clickhouse/client'
import { MongoClient } from 'mongodb'
import { ConnectionCredentials } from 'thunder-schema'
import { FlatFilesRecords } from '@/models/flat-files-records'
import { EntityModel } from '@/@types/model'
import {
  FlatFilesRecordsSchema,
  FlatFileValidationResult,
  FlatFilesRecordsError,
} from '@/@types/flat-files'
import { logger } from '@/core/logger'

export abstract class FlatFileBaseRunner<
  T extends EntityModel | { [key: string]: string }
> {
  protected readonly tenantId: string
  protected readonly dynamoDb: DynamoDBDocumentClient
  protected readonly mongoDb: MongoClient
  protected readonly clickhouseClient: ClickHouseClient
  protected readonly clickhouseConnectionConfig: ConnectionCredentials
  protected readonly flatFilesRecords: FlatFilesRecords

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
    this.flatFilesRecords = new FlatFilesRecords({
      credentials: this.clickhouseConnectionConfig,
      options: {
        keepAlive: true,
        keepAliveTimeout: 60_000,
        maxRetries: 10, // 10 retries
      },
    })
  }

  public abstract concurrency: number
  public abstract model: EntityModel | ((metadata: object) => EntityModel)

  abstract validate(
    data: T,
    metadata?: object
  ): Promise<Pick<FlatFileValidationResult, 'valid' | 'errors'>>

  protected abstract processBatch(
    batch: Array<FlatFilesRecordsSchema>,
    metadata: object
  ): Promise<void>

  protected parseRecord(record: FlatFilesRecordsSchema): T {
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

  protected formatError(error: unknown): FlatFilesRecordsError {
    return {
      keyword: error instanceof Error ? error.name : 'unknown',
      message: error instanceof Error ? error.message : 'unknown',
      stage: 'RUNNER',
    }
  }

  protected async updateRecordStatus(
    schema: FlatFilesRecordsSchema,
    isProcessed: boolean,
    errors?: FlatFilesRecordsError[]
  ): Promise<void> {
    await this.flatFilesRecords
      .create({
        ...schema,
        isProcessed,
        updatedAt: Date.now(),
        error: errors || schema.error,
      })
      .save()
  }

  protected async sanitizeRecord(
    schema: FlatFilesRecordsSchema
  ): Promise<{ data: T; schema: FlatFilesRecordsSchema } | undefined> {
    const recordId = `${schema.fileId}:${schema.row}`
    if (schema.error?.length > 0) {
      logger.info(`Skipping record ${recordId} due to existing errors`, {
        recordId,
        error: schema.error,
      })
      await this.updateRecordStatus(schema, true)
      return undefined
    }
    try {
      const data = this.parseRecord(schema)
      return { data, schema }
    } catch (error: unknown) {
      const errorDetails = this.formatError(error)
      logger.error(`Failed to parse record ${recordId}`, {
        error: errorDetails,
        recordId,
        fileId: schema.fileId,
        row: schema.row,
      })

      // Update failed record
      await this.updateRecordStatus(schema, true, [errorDetails])
      return undefined
    }
  }

  public async run(s3Key: string, metadata: object): Promise<void> {
    try {
      const records = this.flatFilesRecords.objects
        .filter({
          fileId: s3Key,
          isProcessed: false,
          isError: false,
        })
        .final()

      const batchSize = this.concurrency
      let currentBatch: Array<FlatFilesRecordsSchema> = []

      for await (const record of records) {
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
    } catch (error) {
      logger.error('Error in FlatFileBaseRunner.run', {
        error: error instanceof Error ? error.message : 'Unknown error',
        s3Key,
        tenantId: this.tenantId,
      })
      throw error
    }
  }
}

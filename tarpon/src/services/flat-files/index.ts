import path from 'path'
import fs from 'fs'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { ConnectionCredentials } from 'thunder-schema'
import { ClickHouseClient } from '@clickhouse/client'
import { S3 } from '@aws-sdk/client-s3'
import { getFlatFileErrorRecordS3Key } from '@flagright/lib/utils'
import { BatchJobRepository } from '../batch-jobs/repositories/batch-job-repository'
import { FlatFileFormat } from './format'
import { CsvFormat } from './format/csv'
import { BulkCaseClosureRunner } from './runner/bulk-case-clousre'
import { CustomListUploadRunner } from './runner/custom-list-upload'
import { RulesImportRunner } from './runner/rule-instances-import'
import { RiskFactorsImportRunner } from './runner/risk-factors-import'
import { JsonlFormat } from './format/jsonl'
import { UserUploadRunner } from './batchRunner/user-upload'
import { FlatFileBaseRunner } from './baseRunner'
import { TransactionUploadRunner } from './batchRunner/transaction-upload'
import { BulkAlertClosureRunner } from './runner/bulk-alert-closure'
import { BulkSanctionsHitsUpdateRunner } from './runner/bulk-sanctions-hits-update'
import { FlatFileSchema } from '@/@types/openapi-internal/FlatFileSchema'
import { traceable } from '@/core/xray'
import { FlatFileTemplateFormat } from '@/@types/openapi-internal/FlatFileTemplateFormat'
import { FlatFileProgressResponse } from '@/@types/openapi-internal/FlatFileProgressResponse'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  executeClickhouseQuery,
  getClickhouseClient,
  getClickhouseCredentials,
} from '@/utils/clickhouse/utils'
import { EntityModel } from '@/@types/model'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { BatchJobParams } from '@/@types/batch-job'
import { TaskStatusChangeStatusEnum } from '@/@types/openapi-internal/TaskStatusChangeStatusEnum'
import { FlatFilesRecords } from '@/models/flat-files-records'
import { logger } from '@/core/logger'
import { CaseConfig } from '@/lambdas/console-api-case/app'

type Connections = {
  dynamoDb: DynamoDBDocumentClient
  mongoDb: MongoClient
  clickhouseClient: ClickHouseClient
  clickhouseConnectionConfig: ConnectionCredentials
}

const ModelCompoundPrimaryKey: Record<
  FlatFileSchema,
  string[] | ((metadata: object) => string[])
> = {
  BULK_CASE_CLOSURE: ['caseId'],
  CUSTOM_LIST_UPLOAD: (metadata: object): string[] => {
    if (
      'items' in metadata &&
      metadata.items &&
      Array.isArray(metadata.items)
    ) {
      return metadata.items
        .filter((item) => item.primaryKey)
        .map((item) => item.key)
    }
    return []
  },
  RULE_INSTANCES_IMPORT: ['id'],
  RISK_FACTORS_IMPORT: ['id'],
  CONSUMER_USERS_UPLOAD: ['userId'],
  BUSINESS_USERS_UPLOAD: ['userId'],
  TRANSACTIONS_UPLOAD: ['transactionId'],
  BULK_ALERT_CLOSURE: ['alertId'],
  BULK_SANCTIONS_HITS_UPDATE: ['sanctionsHitId'],
}

const FlatFileSchemaToModel: Record<
  FlatFileSchema,
  (tenantId: string, connections: Connections) => FlatFileBaseRunner<any>
> = {
  BULK_CASE_CLOSURE: (tenantId, connections) =>
    new BulkCaseClosureRunner(tenantId, connections),
  CUSTOM_LIST_UPLOAD: (tenantId, connections) =>
    new CustomListUploadRunner(tenantId, connections),
  RULE_INSTANCES_IMPORT: (tenantId, connections) =>
    new RulesImportRunner(tenantId, connections),
  RISK_FACTORS_IMPORT: (tenantId, connections) =>
    new RiskFactorsImportRunner(tenantId, connections),
  CONSUMER_USERS_UPLOAD: (tenantId, connections) =>
    new UserUploadRunner<User>(tenantId, 'CONSUMER', connections),
  BUSINESS_USERS_UPLOAD: (tenantId, connections) =>
    new UserUploadRunner<Business>(tenantId, 'BUSINESS', connections),
  TRANSACTIONS_UPLOAD: (tenantId, connections) =>
    new TransactionUploadRunner(tenantId, connections),
  BULK_ALERT_CLOSURE: (tenantId, connections) =>
    new BulkAlertClosureRunner(tenantId, connections),
  BULK_SANCTIONS_HITS_UPDATE: (tenantId, connections) =>
    new BulkSanctionsHitsUpdateRunner(tenantId, connections),
}

const FlatFileFormatToModel: Record<
  FlatFileTemplateFormat,
  (
    tenantId: string,
    model: typeof EntityModel,
    s3Key: string,
    compoundPrimaryKey: string[]
  ) => FlatFileFormat
> = {
  CSV: (tenantId, model, s3Key, compoundPrimaryKey) =>
    new CsvFormat(tenantId, model, s3Key, compoundPrimaryKey),
  JSONL: (tenantId, model, s3Key, compoundPrimaryKey) =>
    new JsonlFormat(tenantId, model, s3Key, compoundPrimaryKey),
}

type ErrorRecord = {
  recordNumber: number
  record: string
  error: string[]
}

@traceable
export class FlatFilesService {
  private readonly tenantId: string
  s3Bucket: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
    const { DOCUMENT_BUCKET } = process.env as CaseConfig
    this.s3Bucket = DOCUMENT_BUCKET
  }

  private async getFormatInstance(
    schema: FlatFileSchema,
    format: FlatFileTemplateFormat,
    model: EntityModel,
    metadata?: object,
    s3Key?: string
  ) {
    const FormatConstructor = FlatFileFormatToModel[format]
    if (!FormatConstructor) {
      throw new Error(
        `Unsupported format '${format}' for tenant ${this.tenantId}`
      )
    }

    try {
      const schemaKey = ModelCompoundPrimaryKey[schema]
      const compoundPrimaryKey =
        typeof schemaKey === 'function'
          ? schemaKey(metadata ?? {})
          : schemaKey ?? []

      return FormatConstructor(
        this.tenantId,
        model as typeof EntityModel,
        s3Key as string,
        compoundPrimaryKey
      )
    } catch (err) {
      throw new Error(
        `Failed to instantiate format '${format}': ${(err as Error).message}`
      )
    }
  }

  private async getRunnerInstance(schema: FlatFileSchema) {
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
    const clickhouseConnectionConfig = await getClickhouseCredentials(
      this.tenantId
    )
    const clickhouseClient = await getClickhouseClient(this.tenantId)
    const Runner = FlatFileSchemaToModel[schema](this.tenantId, {
      dynamoDb,
      mongoDb,
      clickhouseClient,
      clickhouseConnectionConfig,
    })
    return Runner
  }

  async getModel(
    schema: FlatFileSchema,
    metadata?: object
  ): Promise<EntityModel> {
    const runnerInstance = await this.getRunnerInstance(schema)
    return typeof runnerInstance.model === 'function' &&
      !runnerInstance.model.prototype
      ? runnerInstance.model(metadata ?? {})
      : runnerInstance.model
  }

  async generateTemplate(
    schema: FlatFileSchema,
    format: FlatFileTemplateFormat,
    metadata?: object
  ) {
    const model = await this.getModel(schema, metadata)
    const formatInstance = await this.getFormatInstance(
      schema,
      format,
      model,
      metadata
    )
    const template = formatInstance.getTemplate()
    return template
  }

  async validateAndStoreRecords(
    schema: FlatFileSchema,
    format: FlatFileTemplateFormat,
    s3Key: string,
    metadata?: object
  ) {
    const runnerInstance = await this.getRunnerInstance(schema)
    const model = await this.getModel(schema, metadata)
    const formatInstance = await this.getFormatInstance(
      schema,
      format,
      model,
      metadata,
      s3Key
    )
    const isAllValid = await formatInstance.validateAndStoreRecords(
      runnerInstance,
      metadata
    )
    return isAllValid
  }

  async run(schema: FlatFileSchema, s3Key: string, metadata: object) {
    const runnerInstance = await this.getRunnerInstance(schema)
    await runnerInstance.run(s3Key, metadata)
    await this.getErroredRows(s3Key)
  }

  async getProgress(
    schema: FlatFileSchema,
    entityId: string
  ): Promise<FlatFileProgressResponse> {
    const mongoDb = await getMongoDbClient()
    let s3Key: string | null = null
    let isValidationJobRunning = true
    let batchJobStatus: TaskStatusChangeStatusEnum | null = null
    // get s3Key from Batchjob collection
    const batchJobRepository = new BatchJobRepository(this.tenantId, mongoDb)
    const filterParams: BatchJobParams = {
      parameters: {
        entityId: entityId,
        schema,
      },
    }
    const fileValidationJobs = await batchJobRepository.getJobs(
      {
        type: 'FLAT_FILES_VALIDATION',
        ...filterParams,
      },
      1
    )
    const lastFileValidationJob = fileValidationJobs[0]
    if (lastFileValidationJob != null) {
      s3Key = lastFileValidationJob.parameters?.s3Key ?? ''
      batchJobStatus = lastFileValidationJob.latestStatus.status
    }
    // if there is ongoing validation job, do not search for file runner job
    if (lastFileValidationJob?.latestStatus.status === 'SUCCESS') {
      const fileRunnerJobs = await batchJobRepository.getJobs(
        {
          type: 'FLAT_FILES_RUNNER',
          ...filterParams,
        },
        1
      )
      if (fileRunnerJobs.length > 0) {
        isValidationJobRunning = false
        s3Key = fileRunnerJobs[0].parameters?.s3Key ?? ''
        batchJobStatus = fileRunnerJobs[0].latestStatus.status
      }
    }

    if (!s3Key || !batchJobStatus) {
      return {
        isValidationJobFound: false,
      }
    }

    const clickhouseClient = await getClickhouseClient(this.tenantId)

    const query = `
    SELECT COUNT(DISTINCT row) AS totalCount,
    COUNT(DISTINCT IF(isProcessed = true, row, NULL)) AS processedRows,
    COUNT(DISTINCT IF(isProcessed = true AND isError = false, row, NULL)) AS savedRows,
    COUNT(DISTINCT IF(isError = true, row, NULL))  AS erroredRows
    FROM ${FlatFilesRecords.tableDefinition.tableName}
    WHERE fileId = '${s3Key}'
    `
    const result = await executeClickhouseQuery<{
      totalCount: number
      savedRows: number
      erroredRows: number
    }>(clickhouseClient, query)

    // Extract count values
    const processedCount = result[0].processedRows
    const totalCount = result[0].totalCount
    const savedRows = result[0].savedRows
    const erroredRows = result[0].erroredRows

    return {
      total: totalCount,
      processed: processedCount,
      saved: savedRows,
      errored: erroredRows,
      status: batchJobStatus,
      isValidationJobRunning,
      erroredRecrodS3Key:
        (batchJobStatus === 'SUCCESS' || batchJobStatus === 'FAILED') &&
        !isValidationJobRunning
          ? getFlatFileErrorRecordS3Key(s3Key)
          : undefined,
    }
  }

  // this function should return a link to a s3 bucket which has a csv of all record which are all errored
  // we can only create csv in /tmp directory of the lambda
  // we should buffer

  private async getErroredRows(s3Key: string): Promise<string> {
    const MAX_BUFFER_SIZE = 1000
    const s3 = new S3()
    try {
      // get flatfile client
      const clickhouseConnectionConfig = await getClickhouseCredentials(
        this.tenantId
      )
      const flatFilesRecords = new FlatFilesRecords({
        credentials: clickhouseConnectionConfig,
        options: {
          keepAlive: true,
          keepAliveTimeout: 60_000,
          maxRetries: 10, // 10 retries
        },
      })

      const fileName = getFlatFileErrorRecordS3Key(s3Key).split('/')[1]
      const filePath = path.resolve('/tmp', fileName)
      let fileBuffer: ErrorRecord[] = []

      const erroredRecords = flatFilesRecords.objects.filter({
        fileId: s3Key,
        isProcessed: true,
        isError: true,
      })

      const header = ['Record number', 'Recrod', 'Error']
      this.writeBufferToFile(filePath, fileBuffer, header) // this will create the file with headers

      for await (const erroredRecord of erroredRecords) {
        const row: ErrorRecord = {
          recordNumber: erroredRecord.row,
          record: erroredRecord.initialRecord,
          error: erroredRecord.error.map((e) => {
            return Object.values(e).join(',')
          }),
        }
        fileBuffer.push(row)
        if (fileBuffer.length === MAX_BUFFER_SIZE) {
          // flush the buffer
          this.writeBufferToFile(filePath, fileBuffer, header)
          fileBuffer = []
        }
      }
      if (fileBuffer.length > 0) {
        // flush buffer
        this.writeBufferToFile(filePath, fileBuffer, header)
        fileBuffer = []
      }

      logger.info('Uploading file to s3 bucket')
      await s3.putObject({
        Bucket: this.s3Bucket,
        Key: getFlatFileErrorRecordS3Key(s3Key),
        Body: fs.createReadStream(filePath),
      })

      return fileName
    } catch (e) {
      logger.error('Error in FlatFileBaseRunner.getErroredRows', {
        error: e,
      })
      throw e
    }
  }

  private writeBufferToFile(
    filePath: string,
    fileBuffer: ErrorRecord[],
    header: string[]
  ) {
    // check for the file
    if (!fs.existsSync(filePath)) {
      // writing the headers
      const formatedHeader = header.map((columnHeader) => {
        const santiziedHeader = columnHeader.split('"').join("'")
        return `"${santiziedHeader}"`
      }) // ensuring commas in header are handled
      fs.appendFileSync(filePath, formatedHeader.join(',') + '\n', 'utf-8')
    }
    const rows: string[] = []
    for (const erroredRecord of fileBuffer) {
      const recordNumber = erroredRecord.recordNumber + 1
      const record = erroredRecord.record.split('"').join("'")
      const error: string = erroredRecord.error.join('-').split('"').join("'")
      rows.push(`${recordNumber},"${record}","${error}"`)
    }

    fs.appendFileSync(filePath, rows.join('\n'), 'utf8')
  }
}

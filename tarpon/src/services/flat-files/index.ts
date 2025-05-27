import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { ConnectionCredentials } from 'thunder-schema'
import { ClickHouseClient } from '@clickhouse/client'
import { FlatFileFormat } from './format'
import { CsvFormat } from './format/csv'
import { FlatFileRunner } from './runner'
import { BulkCaseClosureRunner } from './runner/bulk-case-clousre'
import { FlatFileSchema } from '@/@types/openapi-internal/FlatFileSchema'
import { traceable } from '@/core/xray'
import { FlatFileTemplateFormat } from '@/@types/openapi-internal/FlatFileTemplateFormat'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  getClickhouseClient,
  getClickhouseCredentials,
} from '@/utils/clickhouse/utils'
import { EntityModel } from '@/@types/model'

type Connections = {
  dynamoDb: DynamoDBDocumentClient
  mongoDb: MongoClient
  clickhouseClient: ClickHouseClient
  clickhouseConnectionConfig: ConnectionCredentials
}

const FlatFileSchemaToModel: Record<
  FlatFileSchema,
  (tenantId: string, connections: Connections) => FlatFileRunner<any>
> = {
  BULK_CASE_CLOSURE: (tenantId, connections) =>
    new BulkCaseClosureRunner(tenantId, connections),
}

const FlatFileFormatToModel: Record<
  FlatFileTemplateFormat,
  (tenantId: string, model: typeof EntityModel, s3Key: string) => FlatFileFormat
> = {
  CSV: (tenantId, model, s3Key) => new CsvFormat(tenantId, model, s3Key),
}

@traceable
export class FlatFilesService {
  private readonly tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  private async getFormatInstance(
    format: FlatFileTemplateFormat,
    model: EntityModel,
    s3Key?: string
  ) {
    const FormatConstructor = FlatFileFormatToModel[format]
    if (!FormatConstructor) {
      throw new Error(
        `Unsupported format '${format}' for tenant ${this.tenantId}`
      )
    }

    try {
      return FormatConstructor(
        this.tenantId,
        model as typeof EntityModel,
        s3Key as string
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

  async generateTemplate(
    schema: FlatFileSchema,
    format: FlatFileTemplateFormat
  ) {
    const runnerInstance = await this.getRunnerInstance(schema)
    const model = runnerInstance.model
    const formatInstance = await this.getFormatInstance(format, model)
    const template = formatInstance.getTemplate()
    return template
  }

  async validateAndStoreRecords(
    schema: FlatFileSchema,
    format: FlatFileTemplateFormat,
    s3Key: string
  ) {
    const runnerInstance = await this.getRunnerInstance(schema)
    const formatInstance = await this.getFormatInstance(
      format,
      runnerInstance.model,
      s3Key
    )
    const isAllValid = await formatInstance.validateAndStoreRecords(
      runnerInstance
    )
    return isAllValid
  }
}

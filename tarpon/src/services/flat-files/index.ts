import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { ConnectionCredentials } from 'thunder-schema'
import { ClickHouseClient } from '@clickhouse/client'
import { FlatFileFormat } from './format'
import { CsvFormat } from './format/csv'
import { BulkCaseClosureRunner } from './runner/bulk-case-clousre'
import { CustomListUploadRunner } from './runner/custom-list-upload'
import { RulesImportRunner } from './runner/rule-instances-import'
import { RiskFactorsImportRunner } from './runner/risk-factors-import'
import { JsonlFormat } from './format/jsonl'
import { UserUploadRunner } from './batchRunner/user-upload'
import { FlatFileBaseRunner } from './baseRunner'
import { BulkAlertClosureRunner } from './runner/bulk-alert-closure'
import { BulkSanctionsHitsUpdateRunner } from './runner/bulk-sanctions-hits-update'
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
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'

type Connections = {
  dynamoDb: DynamoDBDocumentClient
  mongoDb: MongoClient
  clickhouseClient: ClickHouseClient
  clickhouseConnectionConfig: ConnectionCredentials
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
  BULK_ALERT_CLOSURE: (tenantId, connections) =>
    new BulkAlertClosureRunner(tenantId, connections),
  BULK_SANCTIONS_HITS_UPDATE: (tenantId, connections) =>
    new BulkSanctionsHitsUpdateRunner(tenantId, connections),
}

const FlatFileFormatToModel: Record<
  FlatFileTemplateFormat,
  (tenantId: string, model: typeof EntityModel, s3Key: string) => FlatFileFormat
> = {
  CSV: (tenantId, model, s3Key) => new CsvFormat(tenantId, model, s3Key),
  JSONL: (tenantId, model, s3Key) => new JsonlFormat(tenantId, model, s3Key),
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
    const formatInstance = await this.getFormatInstance(format, model)
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
    const formatInstance = await this.getFormatInstance(format, model, s3Key)
    const isAllValid = await formatInstance.validateAndStoreRecords(
      runnerInstance,
      metadata
    )
    return isAllValid
  }

  async run(schema: FlatFileSchema, metadata: object) {
    const runnerInstance = await this.getRunnerInstance(schema)
    await runnerInstance.run(metadata)
  }
}

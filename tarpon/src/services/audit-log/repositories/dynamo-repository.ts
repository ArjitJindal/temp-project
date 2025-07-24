import { StackConstants } from '@lib/constants'
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb'
import { omit } from 'lodash'
import * as Sentry from '@sentry/aws-serverless'
import { ClickhouseAuditLogRepository } from './clickhouse-repository'
import { traceable } from '@/core/xray'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { sanitizeMongoObject, DynamoTransactionBatch } from '@/utils/dynamodb'
import { getClickhouseClient } from '@/utils/clickhouse/utils'

@traceable
export class DynamoAuditLogRepository {
  private readonly tenantId: string
  private readonly dynamoDb: DynamoDBDocumentClient
  private readonly tableName: string
  clickhouseAuditLogRepository?: ClickhouseAuditLogRepository

  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
    this.tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
  }
  private async getClickhouseAuditLogRepository(): Promise<ClickhouseAuditLogRepository> {
    if (this.clickhouseAuditLogRepository) {
      return this.clickhouseAuditLogRepository
    }
    const clickhouseClient = await getClickhouseClient(this.tenantId)
    this.clickhouseAuditLogRepository = new ClickhouseAuditLogRepository(
      this.tenantId,
      {
        clickhouseClient,
      }
    )
    return this.clickhouseAuditLogRepository
  }
  public async saveAuditLog(auditLog: AuditLog): Promise<void> {
    const clickhouseAuditLogRepository =
      await this.getClickhouseAuditLogRepository()
    try {
      const data = omit(sanitizeMongoObject(auditLog), ['_id'])
      const key = DynamoDbKeys.AUDIT_LOGS(this.tenantId, auditLog.auditlogId)

      // Create batch for operations
      const batch = new DynamoTransactionBatch(this.dynamoDb, this.tableName)

      batch.put({
        Item: {
          ...key,
          ...data,
        },
      })

      await batch.execute()
    } catch (error) {
      Sentry.captureMessage('Error saving audit log to DynamoDB', {
        level: 'warning',
        extra: {
          error,
          auditLog,
        },
      })
    } finally {
      await clickhouseAuditLogRepository.saveAuditLog(auditLog)
    }
  }

  public async getAuditLogById(auditlogId: string): Promise<AuditLog | null> {
    const data = await this.dynamoDb.send(
      new GetCommand({
        TableName: this.tableName,
        Key: DynamoDbKeys.AUDIT_LOGS(this.tenantId, auditlogId),
      })
    )
    return (data.Item as AuditLog) ?? null
  }
}

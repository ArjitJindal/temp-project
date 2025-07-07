import { MongoClient, Document, AggregationCursor, Filter } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import * as Sentry from '@sentry/serverless'

import { omit } from 'lodash'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

import { stageAndRegion } from '@flagright/lib/utils'
import { logger } from '@/core/logger'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import {
  paginatePipeline,
  prefixRegexMatchFilterForArray,
} from '@/utils/mongodb-utils'
import { AUDITLOG_COLLECTION } from '@/utils/mongodb-definitions'
import { DefaultApiGetAuditlogRequest } from '@/@types/openapi-internal/RequestParameters'
import { COUNT_QUERY_LIMIT } from '@/utils/pagination'
import { traceable } from '@/core/xray'
import {
  batchInsertToClickhouse,
  getClickhouseClient,
  isClickhouseEnabledInRegion,
  isClickhouseMigrationEnabled,
} from '@/utils/clickhouse/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { ClickhouseAuditLogRepository } from '@/services/audit-log/repositories/clickhouse-repository'
import { DynamoAuditLogRepository } from '@/services/audit-log/repositories/dynamo-repository'
import { getAllTenantIds } from '@/utils/tenant'

@traceable
export class AuditLogRepository {
  tenantId: string
  mongoDb: MongoClient
  clickhouseAuditLogRepository?: ClickhouseAuditLogRepository
  dynamoDb: DynamoDBDocumentClient
  dynamoAuditLogRepository: DynamoAuditLogRepository
  auditLogTableName: string
  constructor(
    tenantId: string,
    connections: { mongoDb?: MongoClient; dynamoDb?: DynamoDBDocumentClient }
  ) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb as MongoClient
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
    this.dynamoAuditLogRepository = new DynamoAuditLogRepository(
      tenantId,
      this.dynamoDb
    )
    this.auditLogTableName = CLICKHOUSE_DEFINITIONS.AUDIT_LOGS.tableName
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

  public async saveAuditLog(auditLog: AuditLog): Promise<AuditLog> {
    const newAuditLog: AuditLog = {
      auditlogId: uuidv4(),
      timestamp: Date.now(),
      ...auditLog,
    }
    const allTenantIds = await getAllTenantIds()
    const db = this.mongoDb.db()
    const [stage] = stageAndRegion()
    if (
      !allTenantIds.has(this.tenantId) &&
      stage !== 'test' &&
      stage !== 'local'
    ) {
      logger.warn('Not saving audit log for unknown tenant:', {
        tenantId: this.tenantId,
        auditlogId: newAuditLog.auditlogId,
        type: newAuditLog.type,
        subtype: newAuditLog.subtype,
        action: newAuditLog.action,
        entityId: newAuditLog.entityId,
        timestamp: newAuditLog.timestamp,
      })
      Sentry.captureException(
        new Error(`Unknown tenantId found in audit log: ${this.tenantId}`),
        {
          extra: {
            tenantId: this.tenantId,
            auditlogId: newAuditLog.auditlogId,
            type: newAuditLog.type,
            subtype: newAuditLog.subtype,
            action: newAuditLog.action,
            entityId: newAuditLog.entityId,
            timestamp: newAuditLog.timestamp,
          },
        }
      )
      return newAuditLog
    }
    if (isClickhouseEnabledInRegion()) {
      await this.dynamoAuditLogRepository.saveAuditLog(newAuditLog)
    }
    const collection = db.collection<AuditLog>(
      AUDITLOG_COLLECTION(this.tenantId)
    )

    await collection.insertOne({
      _id: newAuditLog.auditlogId as any,
      ...newAuditLog,
    })
    return newAuditLog
  }

  public async getAuditLog(auditlogId: string): Promise<AuditLog | null> {
    if (isClickhouseMigrationEnabled()) {
      return await this.dynamoAuditLogRepository.getAuditLogById(auditlogId)
    }
    const db = this.mongoDb.db()
    const collection = db.collection<AuditLog>(
      AUDITLOG_COLLECTION(this.tenantId)
    )
    const auditLog = await collection.findOne({ _id: auditlogId as any })
    return auditLog ? omit(auditLog, '_id') : null
  }

  private getAuditLogMongoQuery(params: DefaultApiGetAuditlogRequest): {
    filter: Filter<AuditLog>
  } {
    const conditions: Filter<AuditLog>[] = []

    conditions.push({
      timestamp: {
        $gte: params.afterTimestamp || 0,
        $lte: params.beforeTimestamp || Number.MAX_SAFE_INTEGER,
      },
    })
    if (params.includeRootUserRecords !== true) {
      conditions.push({
        'user.role': { $ne: 'root' },
      })
    }

    if (params.filterTypes?.length) {
      conditions.push({
        type: {
          $in: params.filterTypes,
        },
      })
    }

    if (
      params.searchEntityId &&
      params.searchEntityId.length > 0 &&
      !params.entityIdExactMatch
    ) {
      const searchEntityRegex = prefixRegexMatchFilterForArray(
        params.searchEntityId,
        true
      )
      conditions.push({
        entityId: searchEntityRegex,
      })
    }

    if (params.searchEntityId && params.entityIdExactMatch) {
      conditions.push({
        entityId: {
          $in: params.searchEntityId,
        },
      })
    }

    if (params.caseStatus && params.caseStatus.length) {
      conditions.push({
        $and: [
          {
            subtype: 'STATUS_CHANGE',
          },
          {
            'newImage.caseStatus': {
              $exists: true,
              $in: params.caseStatus,
            },
          },
        ],
      })
    }

    if (params.alertStatus && params.alertStatus.length) {
      conditions.push({
        $and: [
          {
            subtype: 'STATUS_CHANGE',
          },
          {
            'newImage.alertStatus': {
              $exists: true,
              $in: params.alertStatus,
            },
          },
        ],
      })
    }

    if (params.filterActionTakenBy != null) {
      conditions.push({
        'user.id': { $in: params.filterActionTakenBy },
      })
    }

    if (params.filterActions?.length) {
      conditions.push({
        action: {
          $in: params.filterActions,
        },
      })
    }

    return {
      filter: { $and: conditions },
    }
  }

  private getAuditLogMongoPipeline(
    params: DefaultApiGetAuditlogRequest
  ): Document[] {
    const sortField =
      params?.sortField !== undefined ? params?.sortField : 'timestamp'
    const sortOrder = params?.sortOrder === 'ascend' ? 1 : -1

    const { filter } = this.getAuditLogMongoQuery(params)

    const pipeline: Document[] = []
    pipeline.push({ $match: filter })
    pipeline.push({ $sort: { [sortField]: sortOrder } })
    return pipeline
  }

  public getAuditLogCursor(
    params: DefaultApiGetAuditlogRequest
  ): AggregationCursor<AuditLog> {
    const pipeline = this.getAuditLogMongoPipeline(params)
    pipeline.push(...paginatePipeline(params))
    return this.getDenormalizedAuditLog(pipeline)
  }

  private getDenormalizedAuditLog(pipeline: Document[]) {
    const db = this.mongoDb.db()
    const collection = db.collection<AuditLog>(
      AUDITLOG_COLLECTION(this.tenantId)
    )
    return collection.aggregate<AuditLog>(pipeline)
  }

  public async getAuditLogCount(
    params: DefaultApiGetAuditlogRequest
  ): Promise<number> {
    if (isClickhouseMigrationEnabled()) {
      const clickhouseAuditLogRepository =
        await this.getClickhouseAuditLogRepository()
      return clickhouseAuditLogRepository.getAuditLogCount(params)
    }
    const db = this.mongoDb.db()
    const collection = db.collection<AuditLog>(
      AUDITLOG_COLLECTION(this.tenantId)
    )
    const conditions = this.getAuditLogMongoQuery(params).filter
    const count = await collection.countDocuments(conditions, {
      limit: COUNT_QUERY_LIMIT,
    })
    return count
  }

  public async getAllAuditLogs(
    params: DefaultApiGetAuditlogRequest
  ): Promise<{ total: number; data: AuditLog[] }> {
    if (isClickhouseMigrationEnabled()) {
      const clickhouseAuditLogRepository =
        await this.getClickhouseAuditLogRepository()
      const auditLogs = await clickhouseAuditLogRepository.getAllAuditLogs(
        params
      )
      return { total: Number(auditLogs.total), data: auditLogs.data }
    }
    const cursor = this.getAuditLogCursor(params)
    const total = this.getAuditLogCount(params)
    return { total: await total, data: await cursor.toArray() }
  }

  public async linkAuditLogClickhouse(auditLog: AuditLog) {
    await batchInsertToClickhouse(
      this.tenantId,
      CLICKHOUSE_DEFINITIONS.AUDIT_LOGS.tableName,
      [auditLog]
    )
  }
}

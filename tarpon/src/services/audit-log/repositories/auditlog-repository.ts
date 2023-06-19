import { MongoClient, Document, AggregationCursor, Filter } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import _ from 'lodash'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { AUDITLOG_COLLECTION, paginatePipeline } from '@/utils/mongoDBUtils'
import { DefaultApiGetAuditlogRequest } from '@/@types/openapi-internal/RequestParameters'
import { COUNT_QUERY_LIMIT } from '@/utils/pagination'

export class AuditLogRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  public async saveAuditLog(auditLog: AuditLog): Promise<AuditLog> {
    const db = this.mongoDb.db()
    const collection = db.collection<AuditLog>(
      AUDITLOG_COLLECTION(this.tenantId)
    )
    const newAuditLog: AuditLog = {
      auditlogId: uuidv4(),
      timestamp: Date.now(),
      ...auditLog,
    }
    await collection.insertOne({
      _id: newAuditLog.auditlogId as any,
      ...newAuditLog,
    })
    return newAuditLog
  }

  public async getAuditLog(auditlogId: string): Promise<AuditLog | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<AuditLog>(
      AUDITLOG_COLLECTION(this.tenantId)
    )
    const auditLog = await collection.findOne({ _id: auditlogId as any })
    return auditLog ? _.omit(auditLog, '_id') : null
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

    if (params.searchEntityId) {
      conditions.push({
        entityId: params.searchEntityId,
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
    const cursor = this.getAuditLogCursor(params)
    const total = this.getAuditLogCount(params)
    return { total: await total, data: await cursor.toArray() }
  }
}

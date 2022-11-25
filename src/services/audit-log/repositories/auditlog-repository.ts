import { MongoClient, Document, AggregationCursor, Filter } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import _ from 'lodash'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { AUDITLOG_COLLECTION } from '@/utils/mongoDBUtils'
import { DefaultApiGetAuditlogRequest } from '@/@types/openapi-internal/RequestParameters'

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
    requiresTransactions: boolean
  } {
    let requiresTransactions = false
    const conditions: Filter<AuditLog>[] = []
    conditions.push({
      timestamp: {
        $gte: params.afterTimestamp || 0,
        $lte: params.beforeTimestamp || Number.MAX_SAFE_INTEGER,
      },
      'user.role': { $ne: 'root' },
    })

    if (params.filterTypes?.length) {
      conditions.push({
        type: {
          $in: params.filterTypes,
        },
      })
      requiresTransactions = true
    }

    return {
      filter: { $and: conditions },
      requiresTransactions,
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
    if (params?.skip) {
      pipeline.push({ $skip: params.skip })
    }
    if (params?.limit) {
      pipeline.push({ $limit: params.limit })
    }
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
    const pipeline = this.getAuditLogMongoPipeline(params)
    pipeline.push({
      $count: 'count',
    })
    const result: AggregationCursor<{ count: number }> =
      await collection.aggregate(pipeline)
    const item = await result.next()
    return item?.count ?? 0
  }

  public async getAllAuditLogs(
    params: DefaultApiGetAuditlogRequest
  ): Promise<{ total: number; data: AuditLog[] }> {
    const cursor = this.getAuditLogCursor(params)
    const total = this.getAuditLogCount(params)
    return { total: await total, data: await cursor.toArray() }
  }
}

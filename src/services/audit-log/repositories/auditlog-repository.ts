import { MongoClient, Document, AggregationCursor, Filter } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import _ from 'lodash'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { AUDITLOG_COLLECTION, paginatePipeline } from '@/utils/mongoDBUtils'
import { DefaultApiGetAuditlogRequest } from '@/@types/openapi-internal/RequestParameters'
import { COUNT_QUERY_LIMIT } from '@/utils/pagination'

type QueryParams = DefaultApiGetAuditlogRequest & {
  includeRootUserRecords?: boolean
}

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

  private getAuditLogMongoQuery(params: QueryParams): {
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
      requiresTransactions = true
    }

    if (params.filterActionTakenBy != null) {
      conditions.push({
        'user.id': { $in: params.filterActionTakenBy },
      })
    }
    return {
      filter: { $and: conditions },
      requiresTransactions,
    }
  }

  private getAuditLogMongoPipeline(params: QueryParams): Document[] {
    const sortField =
      params?.sortField !== undefined ? params?.sortField : 'timestamp'
    const sortOrder = params?.sortOrder === 'ascend' ? 1 : -1

    const { filter } = this.getAuditLogMongoQuery(params)

    const pipeline: Document[] = []
    pipeline.push({ $match: filter })
    pipeline.push({ $sort: { [sortField]: sortOrder } })
    return pipeline
  }

  public getAuditLogCursor(params: QueryParams): AggregationCursor<AuditLog> {
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

  public async getAuditLogCount(params: QueryParams): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<AuditLog>(
      AUDITLOG_COLLECTION(this.tenantId)
    )
    const pipeline = this.getAuditLogMongoPipeline(params)
    pipeline.push({
      $limit: COUNT_QUERY_LIMIT,
    })
    pipeline.push({
      $count: 'count',
    })
    const result: AggregationCursor<{ count: number }> =
      await collection.aggregate(pipeline)
    const item = await result.next()
    return item?.count ?? 0
  }

  public async getAllAuditLogs(
    params: QueryParams
  ): Promise<{ total: number; data: AuditLog[] }> {
    const cursor = this.getAuditLogCursor(params)
    const total = this.getAuditLogCount(params)
    return { total: await total, data: await cursor.toArray() }
  }
}

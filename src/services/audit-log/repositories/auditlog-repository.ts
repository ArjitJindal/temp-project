import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import _ from 'lodash'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { AUDITLOG_COLLECTION } from '@/utils/mongoDBUtils'

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
}

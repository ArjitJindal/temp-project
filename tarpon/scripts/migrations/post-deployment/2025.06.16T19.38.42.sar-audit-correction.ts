import pMap from 'p-map'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import {
  AUDITLOG_COLLECTION,
  REPORT_COLLECTION,
} from '@/utils/mongodb-definitions'
import { Report } from '@/@types/openapi-internal/Report'
import { getMongoDbClientDb, processCursorInBatch } from '@/utils/mongodb-utils'
import { getReportAuditLogMetadata } from '@/utils/audit-log'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClientDb()
  const auditLogCollection = mongoDb.collection<AuditLog>(
    AUDITLOG_COLLECTION(tenant.id)
  )
  const reportCollection = mongoDb.collection<Report>(
    REPORT_COLLECTION(tenant.id)
  )

  const cursor = auditLogCollection.find({
    type: 'SAR',
    subtype: 'CREATION',
    action: 'CREATE',
  })

  await processCursorInBatch(cursor, async (auditLogs) => {
    const bulkOperation: {
      updateOne: {
        filter: { entityId: string }
        update: { $set: object }
      }
    }[] = []
    const reportIds = new Set<string>()
    const auditLogCreationMap = new Map<string, number>()

    auditLogs.forEach((auditLog) => {
      const reportId = auditLog.entityId
      const auditLogCreationTime = auditLog.timestamp ?? 0

      if (reportId) {
        reportIds.add(reportId)
        auditLogCreationMap.set(reportId, auditLogCreationTime)
      }
    })

    const reports = await reportCollection
      .find({
        id: { $in: Array.from(reportIds) },
      })
      .project({ id: 1, createdAt: 1 })
      .toArray()

    for (const report of reports) {
      const auditLogCreationTime = auditLogCreationMap.get(report.id)
      if (
        auditLogCreationTime &&
        report.createdAt &&
        auditLogCreationTime !== report.createdAt
      ) {
        bulkOperation.push({
          updateOne: {
            filter: { entityId: report.id },
            update: { $set: { timestamp: report.createdAt } },
          },
        })
      }
    }
    if (bulkOperation.length > 0) {
      await auditLogCollection.bulkWrite(bulkOperation)
    }
  })

  // creating audit logs for draft reports
  const draftReportCursor = reportCollection.find({
    status: 'DRAFT',
  })

  await processCursorInBatch(draftReportCursor, async (draftReports) => {
    const bulkOperation: AuditLog[] = []
    await pMap(draftReports, async (draftReport) => {
      const savedAuditLog = await auditLogCollection.findOne({
        entityId: draftReport.id,
        type: 'SAR',
        subtype: 'CREATION',
        action: 'CREATE',
      })
      if (!savedAuditLog) {
        const auditLog: AuditLog = {
          type: 'SAR',
          subtype: 'CREATION',
          action: 'CREATE',
          timestamp: draftReport.createdAt,
          newImage: draftReport,
          entityId: draftReport.id,
          logMetadata: getReportAuditLogMetadata(draftReport),
        }
        bulkOperation.push(auditLog)
      }
    })

    if (bulkOperation.length > 0) {
      await auditLogCollection.insertMany(bulkOperation)
    }
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
  throw new Error('test')
}
export const down = async () => {
  // skip
}

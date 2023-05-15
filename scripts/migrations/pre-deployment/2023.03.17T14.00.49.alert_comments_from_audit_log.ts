import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { AuditLogRepository } from '@/services/audit-log/repositories/auditlog-repository'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { getErrorMessage } from '@/utils/lang'
import { Comment } from '@/@types/openapi-internal/Comment'
import { iterateItems } from '@/utils/pagination'
import { CaseClosingReasons } from '@/@types/openapi-internal/CaseClosingReasons'
import { AlertsRepository } from '@/services/rules-engine/repositories/alerts-repository'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()

  const auditLogRepository = new AuditLogRepository(tenant.id, mongoDb)
  const alertsRepository = new AlertsRepository(tenant.id, {
    mongoDb,
  })

  const failedLogEntries: (string | undefined)[] = []
  const skippedLogEntries: (string | undefined)[] = []

  const logEntryIterator = iterateItems((pagination) =>
    auditLogRepository.getAllAuditLogs({
      filterTypes: ['ALERT'],
      includeRootUserRecords: true,
      ...pagination,
    })
  )
  for await (const logEntry of logEntryIterator) {
    try {
      if (logEntry.type === 'ALERT' && logEntry.action === 'UPDATE') {
        const newImage = logEntry.newImage
        if (newImage.alertStatus !== logEntry.oldImage.alertStatus) {
          const alertId = logEntry.entityId
          if (alertId == null) {
            throw new Error('Alert id is null, unable to migrate')
          }
          const alert = await alertsRepository.getAlertById(alertId)
          if (alert == null) {
            throw new Error(`"${alertId}" alert not found`)
          }
          if (alert.caseId == null) {
            throw new Error(`Alert case id is null`)
          }

          /*
            Trying to find existed alert comments for current log entry.
            Doing this by comment body and by timestamp, suggestion is that
            log entry should be created after comment added within 10 seconds
           */
          const statusComments =
            alert.comments?.filter((comment) =>
              comment.body.startsWith(
                `Alert status changed to ${newImage.alertStatus}`
              )
            ) ?? []
          const logEntryComment = statusComments.find((comment) => {
            if (comment.createdAt == null || logEntry.timestamp == null) {
              return false
            }
            return Math.abs(comment.createdAt - logEntry.timestamp) < 10000
          })
          if (logEntryComment != null) {
            skippedLogEntries.push(logEntry.auditlogId)
            continue
          }

          let body = `Alert status changed to ${newImage.alertStatus}`
          const allReasons = [
            ...newImage.reason.filter((x: CaseClosingReasons) => x !== 'Other'),
            ...(newImage.reason.includes('Other') && newImage.otherReason
              ? [newImage.otherReason]
              : []),
          ]
          if (allReasons.length > 0) {
            body += `. Reasons: ${allReasons.join(', ')}`
          }
          if (newImage.comment) {
            body += `. ${newImage.comment}`
          }

          const comment: Comment = {
            body: body,
            userId: logEntry.user?.id,
            createdAt: logEntry.timestamp,
          }
          await alertsRepository.saveAlertComment(
            alert.caseId,
            alertId,
            comment
          )
        }
      }
    } catch (e) {
      console.log(`Unable to migrate entry log. ${getErrorMessage(e)}`)
      failedLogEntries.push(logEntry.auditlogId)
    }
  }

  if (failedLogEntries.length > 0) {
    console.log('-----------------------------------------------')
    console.log('Failed to migrate following audit log entries:')
    for (const id of failedLogEntries) {
      console.log(id)
    }
  }
  if (skippedLogEntries.length > 0) {
    console.log('-----------------------------------------------')
    console.log(
      'Following log entries were skipped since they already have relevant comment'
    )
    for (const id of skippedLogEntries) {
      console.log(id)
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

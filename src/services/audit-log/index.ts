import { PublishCommand, SNSClient } from '@aws-sdk/client-sns'
import * as Sentry from '@sentry/serverless'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { AuditLogRecord } from '@/@types/audit-log'
import { getContext } from '@/core/utils/context'
import { Account } from '@/@types/openapi-internal/Account'
import { logger } from '@/core/logger'

const snsClient = new SNSClient({})

export async function publishAuditLog(
  tenantId: string,
  auditlog: AuditLog
): Promise<void> {
  try {
    if (getContext()?.user?.role !== 'root') {
      const auditLogRecord: AuditLogRecord = {
        tenantId,
        payload: {
          user: getContext()?.user as Account,
          timestamp: Date.now(),
          ...auditlog,
        },
      }
      await snsClient.send(
        new PublishCommand({
          TopicArn: process.env.AUDITLOG_TOPIC_ARN as string,
          Message: JSON.stringify(auditLogRecord),
        })
      )
    }
  } catch (e) {
    Sentry.captureException(e)
    logger.error('Failed to publish audit log', e)
  }
}

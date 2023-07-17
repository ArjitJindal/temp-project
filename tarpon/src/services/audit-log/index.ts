import { PublishCommand, SNSClient } from '@aws-sdk/client-sns'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { AuditLogRecord } from '@/@types/audit-log'
import { getContext } from '@/core/utils/context'
import { Account } from '@/@types/openapi-internal/Account'
import { logger } from '@/core/logger'
import { skipAuditLogs } from '@/test-utils/auditlog-test-utils'

const snsClient = new SNSClient({})

export async function publishAuditLog(
  tenantId: string,
  auditlog: AuditLog
): Promise<void> {
  if (skipAuditLogs) {
    return
  }
  try {
    const auditLogRecord: AuditLogRecord = {
      tenantId,
      payload: {
        user: getContext()?.user as Account,
        timestamp: Date.now(),
        ...auditlog,
      },
    }
    if (process.env.NODE_ENV === 'development') {
      const { auditLogConsumerHandler } = await import(
        '@/lambdas/audit-log-consumer/app'
      )
      const { createSqsEventForSns } = await import(
        '@/test-utils/sqs-test-utils'
      )
      await (auditLogConsumerHandler as any)(
        createSqsEventForSns([auditLogRecord]),
        {},
        {}
      )
      return
    }

    if (process.env.NODE_ENV !== 'test') {
      await snsClient.send(
        new PublishCommand({
          TopicArn: process.env.AUDITLOG_TOPIC_ARN as string,
          Message: JSON.stringify(auditLogRecord),
        })
      )
    }
  } catch (e) {
    logger.error('Failed to publish audit log', e)
  }
}

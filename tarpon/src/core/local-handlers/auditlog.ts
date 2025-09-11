import { AuditLogRecord } from '@/@types/audit-log'
import { createSqsEventForSns } from '@/test-utils/sqs-test-utils'

export const notificationsConsumerHandler = async (
  auditLogRecord: AuditLogRecord
) => {
  const { notificationsConsumerHandler } = await import(
    '@/lambdas/notifications-consumer/app'
  )
  const { createSqsEventForSns } = await import('@/test-utils/sqs-test-utils')
  await notificationsConsumerHandler(
    createSqsEventForSns([auditLogRecord]),
    {},
    {}
  )
}

export const auditLogConsumerHandler = async (
  auditLogRecord: AuditLogRecord
) => {
  const { auditLogConsumerHandler } = await import(
    '@/lambdas/audit-log-consumer/app'
  )
  await auditLogConsumerHandler(createSqsEventForSns([auditLogRecord]), {}, {})
}

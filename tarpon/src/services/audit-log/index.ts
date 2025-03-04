import { PublishCommand } from '@aws-sdk/client-sns'
import { MongoClient } from 'mongodb'
import { AuditLogRepository } from './repositories/auditlog-repository'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { AuditLogRecord } from '@/@types/audit-log'
import { getContext } from '@/core/utils/context'
import { Account } from '@/@types/openapi-internal/Account'
import { logger } from '@/core/logger'
import { envIs } from '@/utils/env'
import { getSNSClient } from '@/utils/sns-sqs-client'
import { DefaultApiGetAuditlogRequest } from '@/@types/openapi-internal/RequestParameters'
import { traceable } from '@/core/xray'

const snsClient = getSNSClient()

export async function publishAuditLog(
  tenantId: string,
  auditlog: AuditLog
): Promise<void> {
  try {
    const auditLogRecord: AuditLogRecord = {
      tenantId,
      payload: {
        user: (getContext()?.user ?? {
          id: FLAGRIGHT_SYSTEM_USER,
        }) as Account,
        timestamp: Date.now(),
        ...auditlog,
      },
    }

    if (process.env.NODE_ENV === 'development') {
      const { auditLogConsumerHandler } = await import(
        '@/lambdas/audit-log-consumer/app'
      )
      const { notificationsConsumerHandler } = await import(
        '@/lambdas/notifications-consumer/app'
      )
      const { createSqsEventForSns } = await import(
        '@/test-utils/sqs-test-utils'
      )

      await Promise.all([
        (auditLogConsumerHandler as any)(
          createSqsEventForSns([auditLogRecord]),
          {},
          {}
        ),
        (notificationsConsumerHandler as any)(
          createSqsEventForSns([auditLogRecord]),
          {},
          {}
        ),
      ])

      return
    } else if (envIs('test')) {
      const { notificationsConsumerHandler } = await import(
        '@/lambdas/notifications-consumer/app'
      )
      const { createSqsEventForSns } = await import(
        '@/test-utils/sqs-test-utils'
      )

      await (notificationsConsumerHandler as any)(
        createSqsEventForSns([auditLogRecord]),
        {},
        {}
      )
      return
    }

    if (envIs('test')) {
      return
    }

    await snsClient.send(
      new PublishCommand({
        TopicArn: process.env.AUDITLOG_TOPIC_ARN as string,
        Message: JSON.stringify(auditLogRecord),
      })
    )
  } catch (e) {
    logger.error(
      `Failed to publish audit log with Entity ID: ${
        auditlog.entityId
      }: ${JSON.stringify(e)}`,
      e
    )
  }
}

@traceable
export class AuditLogService {
  mongoDb: MongoClient
  tenantId: string
  auditLogRepository: AuditLogRepository

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
    this.auditLogRepository = new AuditLogRepository(tenantId, this.mongoDb)
  }

  public async getAllAuditLogs(
    params: DefaultApiGetAuditlogRequest
  ): Promise<{ data: AuditLog[]; total: number }> {
    return this.auditLogRepository.getAllAuditLogs(params)
  }

  public async saveAuditLog(auditlog: AuditLog): Promise<AuditLog> {
    const savedAuditLog = await this.auditLogRepository.saveAuditLog(auditlog)

    logger.debug(
      `Saved audit log: ${savedAuditLog.action}, ${savedAuditLog.type}`,
      {
        tenantId: this.tenantId,
        auditlogId: savedAuditLog.auditlogId,
      }
    )
    return savedAuditLog
  }
}

import { SQSEvent } from 'aws-lambda'
import { AuditLogRecord } from '@/@types/audit-log'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { AuditLogRepository } from '@/services/audit-log/repositories/auditlog-repository'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { logger } from '@/core/logger'

export const auditLogConsumerHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    const mongoDb = await getMongoDbClient()
    for (const record of event.Records) {
      const snsMessage = JSON.parse(record.body)
      const { tenantId, payload } = JSON.parse(
        snsMessage.Message as string
      ) as AuditLogRecord
      const auditLogRepository = new AuditLogRepository(tenantId, mongoDb)
      const savedAuditLog = await auditLogRepository.saveAuditLog(payload)
      logger.info(
        `Saved audit log: ${savedAuditLog.action}, ${savedAuditLog.type}`,
        {
          tenantId,
          auditlogId: savedAuditLog.auditlogId,
        }
      )
    }
  }
)

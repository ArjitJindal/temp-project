import { SQSEvent } from 'aws-lambda'
import { AuditLogRecord } from '@/@types/audit-log'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { AuditLogService } from '@/services/audit-log'

export const auditLogConsumerHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    const mongoDb = await getMongoDbClient()
    for (const record of event.Records) {
      const snsMessage = JSON.parse(record.body)
      const { tenantId, payload } = JSON.parse(
        snsMessage.Message as string
      ) as AuditLogRecord
      const auditLogService = new AuditLogService(tenantId, mongoDb)
      await auditLogService.saveAuditLog(payload)
    }
  }
)

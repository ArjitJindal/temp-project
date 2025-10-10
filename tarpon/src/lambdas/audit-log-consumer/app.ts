import { SQSEvent } from 'aws-lambda'
import { AuditLogRecord } from '@/@types/audit-log'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { AuditLogService } from '@/services/audit-log'
import {
  withContext,
  initializeTenantContext,
  addSentryExtras,
} from '@/core/utils/context'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { logger } from '@/core/logger'

export const auditLogConsumerHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    for (const record of event.Records) {
      const snsMessage = JSON.parse(record.body)
      const { tenantId, payload } = JSON.parse(
        snsMessage.Message as string
      ) as AuditLogRecord

      if (!tenantId) {
        addSentryExtras({ payload })
        logger.error('Tenant id is missing', { payload })
        return
      }

      await withContext(async () => {
        await initializeTenantContext(tenantId)
        const auditLogService = new AuditLogService(tenantId, {
          mongoDb,
          dynamoDb,
        })
        await auditLogService.saveAuditLog(payload)
      })
    }
  }
)

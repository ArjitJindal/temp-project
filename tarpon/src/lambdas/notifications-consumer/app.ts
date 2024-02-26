import { SQSEvent } from 'aws-lambda'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import {
  hasFeature,
  initializeTenantContext,
  withContext,
} from '@/core/utils/context'
import { NotificationsService } from '@/services/notifications'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'

export const notificationsConsumerHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    const mongoDb = await getMongoDbClient()

    for (const record of event.Records) {
      const snsMessage = JSON.parse(record.body)
      const { tenantId, payload } = JSON.parse(snsMessage.Message as string)

      await withContext(async () => {
        await initializeTenantContext(tenantId)

        if (!hasFeature('NOTIFICATIONS')) {
          return
        }

        const notificationsService = new NotificationsService(tenantId, {
          mongoDb,
        })

        await notificationsService.handleNotification(payload as AuditLog)
      })
    }
  }
)

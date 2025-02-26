import { SQSEvent } from 'aws-lambda'
import { groupBy } from 'lodash'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import {
  hasFeature,
  initializeTenantContext,
  withContext,
} from '@/core/utils/context'
import { NotificationsService } from '@/services/notifications'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { getDynamoDbClient } from '@/utils/dynamodb'

export const notificationsConsumerHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()

    const events = event.Records.map((record) =>
      JSON.parse(JSON.parse(record.body).Message as string)
    )
    const groups = groupBy(events, (event) => event.tenantId)
    for (const [tenantId, tenantEvents] of Object.entries(groups)) {
      await withContext(async () => {
        await initializeTenantContext(tenantId)
        if (!hasFeature('NOTIFICATIONS')) {
          return
        }

        const notificationsService = new NotificationsService(tenantId, {
          mongoDb,
          dynamoDb,
        })
        for (const event of tenantEvents) {
          await notificationsService.handleNotification(
            event.payload as AuditLog
          )
        }
      })
    }
  }
)

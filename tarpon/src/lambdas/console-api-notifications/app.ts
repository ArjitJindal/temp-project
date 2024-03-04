import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { ConsoleNotifications } from '@/services/notifications/console-notifications'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export const notificationsHandler = lambdaApi({
  requiredFeatures: ['NOTIFICATIONS'],
})(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const handlers = new Handlers()
    const mongoDb = await getMongoDbClient()

    handlers.registerGetNotifications(async (ctx, request) => {
      const notificationsService = new ConsoleNotifications(tenantId, {
        mongoDb,
      })

      const accountId = ctx.userId
      const page = request.page || 1

      const notifications = await notificationsService.getConsoleNotifications(
        accountId,
        {
          page,
        }
      )

      return {
        data: notifications,
      }
    })

    handlers.registerPostNotificationsMarkAllRead(async (ctx) => {
      const notificationsService = new ConsoleNotifications(tenantId, {
        mongoDb,
      })

      const accountId = ctx.userId

      await notificationsService.markAllAsRead(accountId)
    })

    handlers.registerPostNotificationsReadNotificationId(
      async (ctx, request) => {
        const notificationsService = new ConsoleNotifications(tenantId, {
          mongoDb,
        })

        const accountId = ctx.userId
        const notificationId = request.notificationId

        await notificationsService.markAsRead(accountId, notificationId)
      }
    )

    return handlers.handle(event)
  }
)

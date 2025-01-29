import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { v4 as uuidv4 } from 'uuid'
import { NotFound } from 'http-errors'
import { WebhookRepository } from '../../services/webhook/repositories/webhook-repository'
import { simpleSendWebhookRequest } from '../webhook-deliverer/app'
import {
  createWebhookSecret,
  deleteWebhookSecrets,
  getWebhookSecrets,
} from '../../services/webhook/utils'
import { WebhookDeliveryRepository } from '../../services/webhook/repositories/webhook-delivery-repository'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { WebhookSecrets } from '@/@types/openapi-internal/WebhookSecrets'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { envIs } from '@/utils/env'
import { WebhookDeliveryTask } from '@/@types/webhook'

export const webhookConfigurationHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const tenantId = (event.requestContext.authorizer?.principalId ||
      event.queryStringParameters?.tenantId) as string
    const mongoClient = await getMongoDbClient()
    const webhookRepository = new WebhookRepository(tenantId, mongoClient)
    const webhookDeliveryRepository = new WebhookDeliveryRepository(
      tenantId,
      mongoClient
    )

    const handlers = new Handlers()

    handlers.registerGetWebhooks(
      async () => await webhookRepository.getWebhooks()
    )

    handlers.registerPostWebhooks(async (ctx, request) => {
      const webhook = request.WebhookConfiguration
      const newWebhookData = await webhookRepository.saveWebhook(webhook)
      const newWebhook = newWebhookData.result
      const secret = uuidv4()

      if (!envIs('local')) {
        await createWebhookSecret(tenantId, newWebhook._id as string, secret)
      }

      return {
        ...newWebhook,
        secret,
      }
    })

    handlers.registerPostWebhooksWebhookid(async (ctx, request) => {
      const webhookId = request.webhookId
      const updatedWebhook = request.WebhookConfiguration
      const existingWebhook = await webhookRepository.getWebhook(webhookId)
      if (existingWebhook == null) {
        throw new NotFound(`webhook ${webhookId} is not found`)
      }

      const newWebhookData = await webhookRepository.saveWebhook({
        ...existingWebhook,
        webhookUrl: updatedWebhook.webhookUrl ?? existingWebhook.webhookUrl,
        events: updatedWebhook.events ?? existingWebhook.events,
        enabled: updatedWebhook.enabled ?? existingWebhook.enabled,
      })

      return newWebhookData.result
    })

    handlers.registerDeleteWebhooksWebhookId(async (ctx, request) => {
      const webhookId = request.webhookId
      const webhook = await webhookRepository.getWebhook(webhookId)
      if (webhook == null) {
        throw new NotFound(`webhook ${webhookId} is not found`)
      }
      await webhookRepository.deleteWebhook(webhook)
      await deleteWebhookSecrets(tenantId, webhookId)
      return
    })

    handlers.registerGetWebhooksWebhookIdSecret(async (ctx, request) => {
      const webhookId = request.webhookId
      const secrets = await getWebhookSecrets(tenantId, webhookId)
      const response: WebhookSecrets = {
        secret: Object.entries(secrets).find(
          (entry) => entry[1] === null
        )?.[0] as string,
        expiringSecret: Object.entries(secrets).find(
          (entry) => entry[1] && entry[1] > Date.now()
        )?.[0],
      }
      return response
    })

    handlers.registerGetWebhooksWebhookIdDeliveries(async (ctx, request) => {
      const [items, total] = await Promise.all([
        webhookDeliveryRepository.getWebhookDeliveryAttempts(
          request.webhookId,
          request
        ),
        webhookDeliveryRepository.getWebhookDeliveryCount(
          request.webhookId,
          request
        ),
      ])

      return {
        items,
        total,
      }
    })

    handlers.registerPostWebhookEventResend(async (ctx, request) => {
      const webhookDeliveryTaskId = request.deliveryTaskId
      // fetch the webhook delivery attempt from the database
      const webhookLatestDeliveryAttempt =
        await webhookDeliveryRepository.getLatestWebhookDeliveryAttempt(
          webhookDeliveryTaskId
        )
      if (!webhookLatestDeliveryAttempt) {
        throw new NotFound(
          `Webhook delivery attempt ${webhookDeliveryTaskId} not found`
        )
      }

      const requestBody = JSON.parse(
        webhookLatestDeliveryAttempt.request.body || '{}'
      ) as {
        createdTimestamp: number
        data: any
        triggeredBy: 'MANUAL' | 'SYSTEM'
      }

      const webhookDeliveryTask: WebhookDeliveryTask = {
        _id: webhookDeliveryTaskId,
        webhookId: webhookLatestDeliveryAttempt.webhookId,
        tenantId: tenantId,
        event: webhookLatestDeliveryAttempt.event,
        createdAt: requestBody.createdTimestamp,
        payload: requestBody.data,
        triggeredBy: requestBody.triggeredBy,
      }

      // replay the webhook event
      try {
        const response = await simpleSendWebhookRequest(webhookDeliveryTask)

        if (!response) {
          return {
            success: false,
            error: 'Webhook server did not respond',
          }
        }

        if (
          response?.status &&
          response?.status >= 300 &&
          response?.status < 600
        ) {
          return {
            success: false,
            error: 'Webhook server returned status ' + response?.status,
          }
        }

        return {
          success: true,
        }
      } catch (error) {
        return {
          success: false,
          error: 'Failed to replay webhook event',
        }
      }
    })

    return await handlers.handle(event)
  }
)

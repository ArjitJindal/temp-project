import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { v4 as uuidv4 } from 'uuid'
import { NotFound } from 'http-errors'
import { WebhookRepository } from '../../services/webhook/repositories/webhook-repository'
import {
  createWebhookSecret,
  deleteWebhookSecrets,
  getWebhookSecrets,
} from '../../services/webhook/utils'
import { WebhookDeliveryRepository } from '../../services/webhook/repositories/webhook-delivery-repository'
import { WebhookAuditLogService } from './services/webhook-audit-log-service'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { WebhookSecrets } from '@/@types/openapi-internal/WebhookSecrets'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { envIs } from '@/utils/env'

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
      const newWebhook = await webhookRepository.saveWebhook(webhook)
      const secret = uuidv4()

      if (!envIs('local')) {
        await createWebhookSecret(tenantId, newWebhook._id as string, secret)
      }

      const response = {
        ...newWebhook,
        secret,
      }

      const webhookAuditLogService = new WebhookAuditLogService(tenantId)
      await webhookAuditLogService.handleAuditLogForWebhookCreated(
        newWebhook._id as string
      )
      return response
    })

    handlers.registerPostWebhooksWebhookid(async (ctx, request) => {
      const webhookId = request.webhookId
      const updatedWebhook = request.WebhookConfiguration
      const existingWebhook = await webhookRepository.getWebhook(webhookId)
      if (existingWebhook == null) {
        throw new NotFound(`webhook ${webhookId} is not found`)
      }
      const webhookAuditLogService = new WebhookAuditLogService(tenantId)
      await webhookAuditLogService.handleAuditLogForWebhookUpdated(
        webhookId,
        existingWebhook,
        {
          ...existingWebhook,
          webhookUrl: updatedWebhook.webhookUrl ?? existingWebhook.webhookUrl,
          events: updatedWebhook.events ?? existingWebhook.events,
          enabled: updatedWebhook.enabled ?? existingWebhook.enabled,
        }
      )
      return await webhookRepository.saveWebhook({
        ...existingWebhook,
        webhookUrl: updatedWebhook.webhookUrl ?? existingWebhook.webhookUrl,
        events: updatedWebhook.events ?? existingWebhook.events,
        enabled: updatedWebhook.enabled ?? existingWebhook.enabled,
      })
    })

    handlers.registerDeleteWebhooksWebhookId(async (ctx, request) => {
      const webhookId = request.webhookId
      await webhookRepository.deleteWebhook(webhookId)
      await deleteWebhookSecrets(tenantId, webhookId)
      const webhookAuditLogService = new WebhookAuditLogService(tenantId)
      await webhookAuditLogService.handleAuditLogForWebhookDeleted(webhookId)
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

    return await handlers.handle(event)
  }
)

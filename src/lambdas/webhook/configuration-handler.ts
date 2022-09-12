import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { v4 as uuidv4 } from 'uuid'
import { NotFound } from 'http-errors'
import { WebhookRepository } from './repositories/webhook-repository'
import {
  createWebhookSecret,
  deleteWebhookSecrets,
  getWebhookSecrets,
} from './utils'
import { WebhookDeliveryRepository } from './repositories/webhook-delivery-repository'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { WebhookConfiguration } from '@/@types/openapi-internal/WebhookConfiguration'
import { WebhookSecrets } from '@/@types/openapi-internal/WebhookSecrets'

export const configurationHandler = lambdaApi()(
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

    if (event.httpMethod === 'GET' && event.resource === '/webhooks') {
      return webhookRepository.getWebhooks()
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/webhooks' &&
      event.body
    ) {
      const webhook = JSON.parse(event.body) as WebhookConfiguration
      const newWebhook = await webhookRepository.saveWebhook(webhook)
      const secret = uuidv4()
      await createWebhookSecret(tenantId, newWebhook._id as string, secret)
      const response: WebhookConfiguration = {
        ...newWebhook,
        secret,
      }
      return response
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/webhooks/{webhookId}' &&
      event.pathParameters?.webhookId &&
      event.body
    ) {
      const updatedWebhook = JSON.parse(event.body) as WebhookConfiguration
      const webhookId = event.pathParameters.webhookId
      const existingWebhook = await webhookRepository.getWebhook(webhookId)
      if (existingWebhook == null) {
        throw new NotFound(`webhook ${webhookId} is not found`)
      }
      return webhookRepository.saveWebhook({
        ...existingWebhook,
        webhookUrl: updatedWebhook.webhookUrl ?? existingWebhook.webhookUrl,
        events: updatedWebhook.events ?? existingWebhook.events,
        enabled: updatedWebhook.enabled ?? existingWebhook.enabled,
      })
    } else if (
      event.httpMethod === 'DELETE' &&
      event.resource === '/webhooks/{webhookId}' &&
      event.pathParameters?.webhookId
    ) {
      await webhookRepository.deleteWebhook(event.pathParameters.webhookId)
      await deleteWebhookSecrets(tenantId, event.pathParameters.webhookId)
      return 'OK'
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/webhooks/{webhookId}/secret' &&
      event.pathParameters?.webhookId
    ) {
      const secrets = await getWebhookSecrets(
        tenantId,
        event.pathParameters.webhookId
      )
      const response: WebhookSecrets = {
        secret: Object.entries(secrets).find(
          (entry) => entry[1] === null
        )?.[0] as string,
        expiringSecret: Object.entries(secrets).find(
          (entry) => entry[1] && entry[1] > Date.now()
        )?.[0],
      }
      return response
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/webhooks/{webhookId}/deliveries' &&
      event.pathParameters?.webhookId
    ) {
      const limit = event.queryStringParameters?.['limit']
      return webhookDeliveryRepository.getWebhookDeliveryAttempts(
        event.pathParameters.webhookId,
        limit ? Number(limit) : 100
      )
    }

    throw new Error('Unhandled request')
  }
)

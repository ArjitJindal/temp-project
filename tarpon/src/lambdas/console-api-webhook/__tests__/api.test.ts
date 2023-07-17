import { webhookConfigurationHandler } from '../app'
import { WebhookRepository } from '@/services/webhook/repositories/webhook-repository'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'
import { WebhookDeliveryRepository } from '@/services/webhook/repositories/webhook-delivery-repository'

const testApiEndPoints = new TestApiEndpoint(
  WebhookRepository,
  webhookConfigurationHandler
)

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/webhooks', methodName: 'getWebhooks' },
  { method: 'POST', path: '/webhooks', methodName: 'saveWebhook' },
  {
    method: 'POST',
    path: '/webhooks/{webhookId}',
    methodName: 'getWebhook',
    payload: { webhookId: '123' },
  },
  {
    method: 'DELETE',
    path: '/webhooks/{webhookId}',
    methodName: 'deleteWebhook',
    payload: { webhookId: '123' },
  },
])('Webhook API', ({ method, path, methodName, payload }) => {
  testApiEndPoints.testApi({ method, path, payload }, methodName)
})

const testApiEndPointsDelivery = new TestApiEndpoint(
  WebhookDeliveryRepository,
  webhookConfigurationHandler
)

describe.each<TestApiEndpointOptions>([
  {
    method: 'GET',
    path: '/webhooks/{webhookId}/deliveries',
    methodName: 'getWebhookDeliveryAttempts',
    payload: { webhookId: '123' },
  },
])('Webhook Delivery API', ({ method, path, methodName, payload }) => {
  testApiEndPointsDelivery.testApi({ method, path, payload }, methodName)
})

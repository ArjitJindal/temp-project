import { webhookConfigurationHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'

const testApiEndPoints = new TestApiEndpoint(webhookConfigurationHandler)

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/webhooks' },
  { method: 'POST', path: '/webhooks' },
  {
    method: 'POST',
    path: '/webhooks/{webhookId}',
    payload: { webhookId: '123' },
  },
  {
    method: 'DELETE',
    path: '/webhooks/{webhookId}',
    payload: { webhookId: '123' },
  },
])('Webhook API', ({ method, path, payload }) => {
  testApiEndPoints.testApi({ method, path, payload })
})

const testApiEndPointsDelivery = new TestApiEndpoint(
  webhookConfigurationHandler
)

describe.each<TestApiEndpointOptions>([
  {
    method: 'GET',
    path: '/webhooks/{webhookId}/deliveries',
    payload: { webhookId: '123' },
  },
])('Webhook Delivery API', ({ method, path, payload }) => {
  testApiEndPointsDelivery.testApi({ method, path, payload })
})

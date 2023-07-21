import { listsHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'

withFeatureHook(['LISTS'])

const testApiEndPoints = new TestApiEndpoint(listsHandler)

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/lists' },
  { method: 'POST', path: '/lists' },
  { method: 'GET', path: '/lists/{listId}' },
  { method: 'PATCH', path: '/lists/{listId}' },
  { method: 'DELETE', path: '/lists/{listId}' },
  { method: 'GET', path: '/lists/{listId}/items' },
  { method: 'POST', path: '/lists/{listId}/items' },
  {
    method: 'DELETE',
    path: '/lists/{listId}/items/{key}',
  },
])('List API', ({ method, path, payload }) => {
  testApiEndPoints.testApi({ method, path, payload })
})

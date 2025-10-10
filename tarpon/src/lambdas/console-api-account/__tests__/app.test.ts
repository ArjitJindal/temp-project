import { accountsHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'

const testApiEndpoint = new TestApiEndpoint(accountsHandler)

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/me' },
  { method: 'GET', path: '/accounts' },
  { method: 'POST', path: '/accounts' },
  {
    method: 'DELETE',
    path: '/accounts/{accountId}',
    payload: { accountId: '123' },
  },
  {
    method: 'POST',
    path: '/accounts/{accountId}/change_tenant',
    payload: { accountId: '123', newTenantId: '456' },
  },
  {
    method: 'POST',
    path: '/accounts/{accountId}',
    payload: { accountId: '123' },
  },
  {
    method: 'GET',
    path: '/accounts/{accountId}/settings',
    payload: { accountId: '123' },
  },
  {
    method: 'PATCH',
    path: '/accounts/{accountId}/settings',
    payload: { accountId: '123' },
  },
])('Test accountsHandler', ({ method, path, payload }) => {
  testApiEndpoint.testApi({ method, path, payload })
})

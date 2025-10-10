import { transactionsViewHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'

const testApiEndPoints = new TestApiEndpoint(transactionsViewHandler)

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/transactions' },
  { method: 'GET', path: '/transactions?responseType=data' },
  { method: 'GET', path: '/transactions?responseType=count' },
  {
    method: 'GET',
    path: '/transactions/stats/by-types',
  },
  {
    method: 'GET',
    path: '/transactions/stats/by-time',
  },
  {
    method: 'GET',
    path: '/transactions/export',
  },
  {
    method: 'GET',
    path: '/transactions/uniques',
  },
  {
    method: 'GET',
    path: '/transactions/{transactionId}',
    payload: { transactionId: '123' },
  },
])('Transactions API', ({ method, path, payload }) => {
  testApiEndPoints.testApi({ method, path, payload })
})

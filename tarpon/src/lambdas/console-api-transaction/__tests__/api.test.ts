import { transactionsViewHandler } from '../app'
import { TransactionService } from '../services/transaction-service'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'

const testApiEndPoints = new TestApiEndpoint(
  TransactionService,
  transactionsViewHandler
)

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/transactions', methodName: 'getTransactions' },
  {
    method: 'GET',
    path: '/transactions/stats/by-types',
    methodName: 'getStatsByType',
  },
  {
    method: 'GET',
    path: '/transactions/stats/by-time',
    methodName: 'getStatsByTime',
  },
  {
    method: 'GET',
    path: '/transactions/export',
    methodName: 'getTransactionsCount',
  },
  {
    method: 'GET',
    path: '/transactions/uniques',
    methodName: 'getUniques',
  },
  {
    method: 'GET',
    path: '/transactions/{transactionId}',
    methodName: 'getTransaction',
    payload: { transactionId: '123' },
  },
])('Transactions API', ({ method, path, methodName, payload }) => {
  testApiEndPoints.testApi({ method, path, payload }, methodName)
})

import { deviceDataHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'

const testApiEndPointsCases = new TestApiEndpoint(deviceDataHandler)

describe.each<TestApiEndpointOptions>([
  {
    method: 'GET',
    path: '/device-data/transactions',
    payload: {
      transactionId: 'transactionId',
      userId: 'userId',
    },
  },
  {
    method: 'GET',
    path: '/device-data/users',
    payload: {
      userId: 'userId',
    },
  },
])('Device Data API', ({ method, path, payload }) => {
  testApiEndPointsCases.testApi({ method, path, payload })
})

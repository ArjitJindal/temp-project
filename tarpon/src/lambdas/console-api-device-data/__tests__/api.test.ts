import { deviceDataHandler } from '../app'
import { DeviceDataService } from '../services/device-data-service'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'

const testApiEndPointsCases = new TestApiEndpoint(
  DeviceDataService,
  deviceDataHandler
)

describe.each<TestApiEndpointOptions>([
  {
    method: 'GET',
    path: '/device-data/transactions',
    payload: {
      transactionId: 'transactionId',
      userId: 'userId',
    },
    methodName: 'getDeviceDataForTransaction',
  },
  {
    method: 'GET',
    path: '/device-data/users',
    payload: {
      userId: 'userId',
    },
    methodName: 'getDeviceDataForUser',
  },
])('Device Data API', ({ method, path, payload, methodName }) => {
  testApiEndPointsCases.testApi({ method, path, payload }, methodName)
})

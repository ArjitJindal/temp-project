import { merchantMonitoringHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'

const testApiEndPoints = new TestApiEndpoint(merchantMonitoringHandler)

describe.each<TestApiEndpointOptions>([
  {
    method: 'POST',
    path: '/merchant-monitoring/summary',
    payload: {
      userId: 'userId',
      refresh: true,
    },
  },
  {
    method: 'POST',
    path: '/merchant-monitoring/history',
    payload: {
      userId: 'userId',
      source: true,
    },
  },
  {
    method: 'POST',
    path: '/merchant-monitoring/scrape',
    payload: {
      userId: 'userId',
      url: true,
    },
  },
])('Merchant Monitoring API', ({ method, path, payload }) => {
  testApiEndPoints.testApi({ method, path, payload })
})

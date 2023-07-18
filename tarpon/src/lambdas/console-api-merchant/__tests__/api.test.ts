import { merchantMonitoringHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
  mockStaticMethod,
} from '@/test-utils/apigateway-test-utils'
import { MerchantMonitoringService } from '@/services/merchant-monitoring'

const testApiEndPoints = new TestApiEndpoint(
  MerchantMonitoringService,
  merchantMonitoringHandler
)

describe.each<TestApiEndpointOptions>([
  {
    method: 'POST',
    path: '/merchant-monitoring/summary',
    methodName: 'getMerchantMonitoringSummaries',
    payload: {
      userId: 'userId',
      refresh: true,
    },
  },
  {
    method: 'POST',
    path: '/merchant-monitoring/history',
    methodName: 'getMerchantMonitoringHistory',
    payload: {
      userId: 'userId',
      source: true,
    },
  },
  {
    method: 'POST',
    path: '/merchant-monitoring/scrape',
    methodName: 'scrapeMerchantMonitoringSummary',
    payload: {
      userId: 'userId',
      url: true,
    },
  },
])('Merchant Monitoring API', ({ method, path, payload, methodName }) => {
  beforeAll(() => {
    mockStaticMethod(
      MerchantMonitoringService,
      'init',
      new MerchantMonitoringService(
        { apiKey: 'apiKey' },
        {
          companiesHouse: 'companiesHouse',
          explorium: 'explorium',
          rapidApi: 'rapidApi',
          scrapfly: 'scrapfly',
        }
      )
    )
  })
  testApiEndPoints.testApi({ method, path, payload }, methodName)
})

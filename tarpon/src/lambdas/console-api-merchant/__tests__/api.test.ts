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
    path: '/summary',
    methodName: 'getMerchantMonitoringSummaries',
  },
  {
    method: 'POST',
    path: '/history',
    methodName: 'getMerchantMonitoringHistory',
  },
  {
    method: 'POST',
    path: '/scrape',
    methodName: 'getMerchantMonitoringHistory',
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

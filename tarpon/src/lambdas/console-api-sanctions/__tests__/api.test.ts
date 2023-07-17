import { sanctionsHandler } from '../app'
import { SanctionsService } from '@/services/sanctions'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
  mockServiceMethod,
} from '@/test-utils/apigateway-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'

const testApiEndPoints = new TestApiEndpoint(SanctionsService, sanctionsHandler)

withFeatureHook(['SANCTIONS'])

describe.each<TestApiEndpointOptions>([
  { method: 'POST', path: '/sanctions/search', methodName: 'search' },
  {
    method: 'GET',
    path: '/sanctions/search',
    methodName: 'getSearchHistories',
  },
  {
    method: 'GET',
    path: '/sanctions/search/{searchId}',
    methodName: 'getSearchHistory',
    payload: { searchId: 'searchId' },
  },
  {
    method: 'POST',
    path: '/sanctions/whitelist',
    methodName: 'addWhitelistEntities',
    payload: { whitelisted: true },
  },
])('Sanctions API', ({ method, path, methodName, payload }) => {
  beforeAll(() => {
    mockServiceMethod(SanctionsService, 'getSearchHistory', {})
  })
  testApiEndPoints.testApi({ method, path, payload }, methodName)
})

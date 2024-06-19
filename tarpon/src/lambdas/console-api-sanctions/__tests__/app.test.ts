import { sanctionsHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'

const testApiEndPoints = new TestApiEndpoint(sanctionsHandler)

withFeatureHook(['SANCTIONS'])

describe.each<TestApiEndpointOptions>([
  { method: 'POST', path: '/sanctions/search' },
  {
    method: 'GET',
    path: '/sanctions/search',
  },
  {
    method: 'GET',
    path: '/sanctions/search/{searchId}',
    payload: { searchId: 'searchId' },
  },
])('Sanctions API', ({ method, path, payload }) => {
  testApiEndPoints.testApi({ method, path, payload })
})

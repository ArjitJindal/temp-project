import { tenantsHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'

const testApiEndPoints = new TestApiEndpoint(tenantsHandler)

describe.each<TestApiEndpointOptions>([{ method: 'GET', path: '/tenants' }])(
  'Tenants API',
  ({ method, path, payload }) => {
    testApiEndPoints.testApi({ method, path, payload })
  }
)

const tenantEndpoint = new TestApiEndpoint(tenantsHandler)

describe.each<TestApiEndpointOptions>([{ method: 'POST', path: '/tenants' }])(
  'Tenants API',
  ({ method, path, payload }) => {
    tenantEndpoint.testApi({ method, path, payload })
  }
)

const tenantRepositoryTest = new TestApiEndpoint(tenantsHandler)

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/tenants/settings' },
  {
    method: 'POST',
    path: '/tenants/settings',
    payload: { alpha: 'alpha' },
  },
])('Tenants API', ({ method, path, payload }) => {
  tenantRepositoryTest.testApi({ method, path, payload })
})

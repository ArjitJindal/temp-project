import { tenantsHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
  mockServiceMethod,
} from '@/test-utils/apigateway-test-utils'
import { AccountsService } from '@/services/accounts'
import { TenantService } from '@/services/tenants'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { setSkipRoleCheck } from '@/test-utils/user-test-utils'
import { setSkipAuditLogs } from '@/test-utils/auditlog-test-utils'

const testApiEndPoints = new TestApiEndpoint(AccountsService, tenantsHandler)

setSkipRoleCheck()
setSkipAuditLogs()

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/tenants', methodName: 'getTenants' },
])('Tenants API', ({ method, path, methodName, payload }) => {
  testApiEndPoints.testApi({ method, path, payload }, methodName)
})

const tenantEndpoint = new TestApiEndpoint(TenantService, tenantsHandler)

describe.each<TestApiEndpointOptions>([
  { method: 'POST', path: '/tenants', methodName: 'createTenant' },
])('Tenants API', ({ method, path, methodName, payload }) => {
  tenantEndpoint.testApi({ method, path, payload }, methodName)
})

const tenantRepositoryTest = new TestApiEndpoint(
  TenantRepository,
  tenantsHandler
)

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/tenants/settings', methodName: 'getTenantSettings' },
  {
    method: 'POST',
    path: '/tenants/settings',
    methodName: 'createOrUpdateTenantSettings',
    payload: { alpha: 'alpha' },
  },
])('Tenants API', ({ method, path, methodName, payload }) => {
  beforeAll(() => {
    mockServiceMethod(TenantRepository, 'getTenantSettings', {})
  })
  tenantRepositoryTest.testApi({ method, path, payload }, methodName)
})

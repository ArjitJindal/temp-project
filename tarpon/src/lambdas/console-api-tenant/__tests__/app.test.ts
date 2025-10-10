import { Forbidden } from 'http-errors'
import { assertSettings, tenantsHandler } from '../app'
import { PermissionStatements } from '@/@types/openapi-internal/PermissionStatements'
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

describe('Assert Settings Test', () => {
  test('Throw error if user does not have permission to change settings', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read', 'write'],
        resources: ['frn:console:test-tenant:::settings/system-config/*'],
      },
    ]
    expect(() =>
      assertSettings(
        {
          aiSourcesDisabled: ['alertActionDate'],
        },
        statements
      )
    ).toThrowError(
      new Forbidden('User does not have permission to change settings')
    )
  })

  test('Do not throw error if user has permission to change settings', () => {
    const statements: PermissionStatements[] = [
      {
        actions: ['read', 'write'],
        resources: [
          'frn:console:test-tenant:::settings/system-config/*',
          'frn:console:test-tenant:::settings/add-ons/ai-features/*',
        ],
      },
    ]

    expect(() =>
      assertSettings(
        {
          aiSourcesDisabled: ['alertActionDate'],
        },
        statements
      )
    ).not.toThrowError(
      new Forbidden('User does not have permission to change settings')
    )
  })
})

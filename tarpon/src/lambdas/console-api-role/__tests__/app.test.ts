import { rolesHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'

const testApiEndPoints = new TestApiEndpoint(rolesHandler)

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/roles' },
  {
    method: 'GET',
    path: '/roles/{roleId}',
    payload: { roleId: 'roleId' },
  },
  { method: 'POST', path: '/roles' },
  { method: 'PATCH', path: '/roles/{roleId}' },
  { method: 'DELETE', path: '/roles/{roleId}' },
])('Roles API', ({ method, path, payload }) => {
  testApiEndPoints.testApi({ method, path, payload })
})

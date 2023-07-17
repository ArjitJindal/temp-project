import { rolesHandler } from '../app'
import { RoleService } from '@/services/roles'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
} from '@/test-utils/apigateway-test-utils'

const testApiEndPoints = new TestApiEndpoint(RoleService, rolesHandler)

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/roles', methodName: 'getTenantRoles' },
  {
    method: 'GET',
    path: '/roles/{roleId}',
    methodName: 'getRole',
    payload: { roleId: 'roleId' },
  },
  { method: 'POST', path: '/roles', methodName: 'createRole' },
  { method: 'PATCH', path: '/roles/{roleId}', methodName: 'updateRole' },
  { method: 'DELETE', path: '/roles/{roleId}', methodName: 'deleteRole' },
])('Roles API', ({ method, path, methodName, payload }) => {
  testApiEndPoints.testApi({ method, path, payload }, methodName)
})

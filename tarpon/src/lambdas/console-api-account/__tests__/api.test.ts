import { accountsHandler } from '../app'
import {
  TestApiEndpoint,
  TestApiEndpointOptions,
  mockServiceMethod,
} from '@/test-utils/apigateway-test-utils'
import { AccountsService } from '@/services/accounts'
import { setSkipAuditLogs } from '@/test-utils/auditlog-test-utils'
import { setSkipRoleCheck } from '@/test-utils/user-test-utils'

const testApiEndpoint = new TestApiEndpoint(AccountsService, accountsHandler)

setSkipAuditLogs()
setSkipRoleCheck()

describe.each<TestApiEndpointOptions>([
  { method: 'GET', path: '/me', methodName: 'getAccount' },
  { method: 'GET', path: '/accounts', methodName: 'getTenantAccounts' },
  { method: 'POST', path: '/accounts', methodName: 'inviteAccount' },
  {
    method: 'DELETE',
    path: '/accounts/{accountId}',
    methodName: 'deleteUser',
    payload: { accountId: '123' },
  },
  {
    method: 'POST',
    path: '/accounts/{accountId}/change_tenant',
    methodName: 'changeUserTenant',
    payload: { accountId: '123', newTenantId: '456' },
  },
  {
    method: 'POST',
    path: '/accounts/{accountId}',
    methodName: 'patchUser',
    payload: { accountId: '123' },
  },
  {
    method: 'GET',
    path: '/accounts/{accountId}/settings',
    methodName: 'getUserSettings',
    payload: { accountId: '123' },
  },
  {
    method: 'PATCH',
    path: '/accounts/{accountId}/settings',
    methodName: 'patchUserSettings',
    payload: { accountId: '123' },
  },
])('Test accountsHandler', ({ method, path, methodName, payload }) => {
  beforeAll(() => {
    mockServiceMethod(AccountsService, 'getAccountTenant', {})
  })
  testApiEndpoint.testApi({ method, path, payload }, methodName)
})

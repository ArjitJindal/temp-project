import { TestApiEvent, TestApiRequestContext } from './types'

export const event: TestApiEvent = {
  resource: '/rule-filters',
  path: '/rule-filters',
  httpMethod: 'GET',
  requestContext: {
    authorizer: { principalId: 'test-tenant-id' },
  } as TestApiRequestContext,
}

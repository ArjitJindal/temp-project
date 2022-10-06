import { TestApiEvent, TestApiRequestContext } from './types'

export const event: TestApiEvent = {
  resource: '/rules',
  path: '/rules',
  httpMethod: 'GET',
  requestContext: {
    authorizer: { principalId: 'test-tenant-id' },
  } as TestApiRequestContext,
}

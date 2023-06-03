import { TestApiEvent, TestApiRequestContext } from './types'

export const event: TestApiEvent = {
  resource: '/transactions',
  path: '/files/getPresignedUrl',
  httpMethod: 'POST',
  headers: {},
  requestContext: {
    accountId: 'test',
    authorizer: { principalId: 'test-tenant-id' },
  } as TestApiRequestContext,
  stageVariables: null,
}

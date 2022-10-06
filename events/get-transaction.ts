import { TestApiEvent, TestApiRequestContext } from './types'

export const event: TestApiEvent = {
  resource: '/transactions',
  path: '/transactions',
  httpMethod: 'GET',
  headers: {},
  requestContext: {
    authorizer: { principalId: 'test-tenant-id' },
  } as TestApiRequestContext,
  pathParameters: {
    transactionId: '7b80a539eea6e78acbd6d458e5971482',
  },
  stageVariables: null,
}

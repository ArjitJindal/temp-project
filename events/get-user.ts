import { TestApiEvent, TestApiRequestContext } from './types'

export const event: TestApiEvent = {
  resource: '/consumer',
  path: '/consumer/users',
  httpMethod: 'GET',
  headers: {},
  requestContext: {
    authorizer: { principalId: 'test-tenant-id' },
  } as TestApiRequestContext,
  pathParameters: {
    userId: '96647cfd9e8fe66ee0f3362e011e34e8',
  },
  stageVariables: null,
}

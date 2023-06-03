import { TestApiEvent, TestApiRequestContext } from './types'

export const event: TestApiEvent = {
  httpMethod: 'GET',
  headers: {},
  requestContext: {
    authorizer: { principalId: 'test' },
  } as TestApiRequestContext,
  queryStringParameters: {
    limit: '1',
    skip: '1',
    beforeTimestamp: '100000000000',
  },
}

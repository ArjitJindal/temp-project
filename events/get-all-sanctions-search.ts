import { TestApiEvent, TestApiRequestContext } from './types'

export const event: TestApiEvent = {
  resource: '/sanctions/search',
  path: '/sanctions/search',
  httpMethod: 'GET',
  headers: {},
  requestContext: {
    authorizer: { principalId: 'flagright' },
  } as TestApiRequestContext,
  stageVariables: null,
}

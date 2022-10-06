import { TestApiEvent, TestApiRequestContext } from './types'

export const event: TestApiEvent = {
  resource: '/sanctions/search/{searchId}',
  httpMethod: 'GET',
  headers: {},
  requestContext: {
    authorizer: { principalId: 'flagright' },
  } as TestApiRequestContext,
  pathParameters: {
    searchId: '319aaad5-436b-45bb-b74f-3d02735f5446',
  },
  stageVariables: null,
}

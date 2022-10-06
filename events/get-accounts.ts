import { TestApiEvent, TestApiRequestContext } from './types'

export const event: TestApiEvent = {
  resource: '/accounts',
  path: '/accounts',
  httpMethod: 'GET',
  requestContext: {
    authorizer: {
      principalId: 'flagright',
      userId: 'auth0|6214112c1f466500695754f9',
    },
  } as TestApiRequestContext,
}

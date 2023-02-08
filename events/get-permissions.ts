import { TestApiEvent, TestApiRequestContext } from './types'

export const event: TestApiEvent = {
  resource: '/roles/{roleId}/permissions',
  path: '/roles',
  httpMethod: 'GET',
  requestContext: {
    authorizer: {
      principalId: 'flagright',
      userId: 'auth0|6214112c1f466500695754f9',
    },
  } as TestApiRequestContext,
  pathParameters: {
    searchId: 'analyst',
  },
}

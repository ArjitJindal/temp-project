import { TestApiEvent, TestApiRequestContext } from './types'

export const event: TestApiEvent = {
  resource: '/rules/{ruleId}',
  path: '/rules/R-1',
  httpMethod: 'DELETE',
  requestContext: {
    authorizer: { principalId: 'test-tenant-id' },
  } as TestApiRequestContext,
  pathParameters: {
    ruleId: 'R-2',
  },
}

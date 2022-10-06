import { TestApiEvent, TestApiRequestContext } from './types'
import { Rule } from '@/@types/openapi-internal/Rule'

interface RuleParameters {
  threshold: number
}

export const event: TestApiEvent = {
  resource: '/rules/{ruleId}',
  path: '/rules/R-1',
  httpMethod: 'PUT',
  requestContext: {
    authorizer: { principalId: 'test-tenant-id' },
  } as TestApiRequestContext,
  pathParameters: {
    ruleId: 'R-1',
  },
  body: JSON.stringify({
    id: 'R-1',
    name: 'Updated awesome rule name',
    description: 'Awesome rule description',
    ruleImplementationName: 'code-path',
    defaultParameters: {
      threshold: 3,
    } as RuleParameters,
  } as Rule),
}

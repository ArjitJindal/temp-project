import { Rule } from '@/@types/openapi-internal/Rule'

export const event = {
  resource: '/rules',
  path: '/rules',
  httpMethod: 'POST',
  requestContext: { authorizer: { principalId: 'test-tenant-id' } },
  body: JSON.stringify({
    id: 'R-1',
    name: 'Awesome rule name',
    description: 'Awesome rule description',
    ruleImplementationName: 'first-payment',
    defaultParameters: {},
    defaultAction: 'FLAG',
  } as Rule),
}

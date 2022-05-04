import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'

export const event = {
  resource: '/rule_instances',
  path: '/rule_instances',
  httpMethod: 'POST',
  requestContext: { authorizer: { principalId: 'test-tenant-id' } },
  body: JSON.stringify({
    type: 'TRANSACTION',
    ruleId: 'R-1',
    status: 'ACTIVE',
    parameters: {},
    action: 'FLAG',
  } as RuleInstance),
}

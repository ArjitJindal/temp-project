import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'

export const event = {
  resource: '/rule_instances',
  path: '/rule_instances',
  httpMethod: 'POST',
  requestContext: { authorizer: { principalId: 'test-tenant-id' } },
  body: JSON.stringify({
    ruleId: 'R-1',
    status: 'ACTIVE',
    parameters: { initialTransactions: 5 },
    action: 'FLAG',
  } as RuleInstance),
}

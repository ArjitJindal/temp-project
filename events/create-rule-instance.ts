import { RuleInstance } from '../src/@types/openapi-internal/RuleInstance'

export const event = {
  resource: '/rule_instances',
  path: '/rule_instances',
  httpMethod: 'POST',
  headers: {},
  queryStringParameters: {
    tenantId: 'test-tenant-id',
  },
  stageVariables: null,
  body: JSON.stringify({
    ruleId: 'R-2',
    status: 'ACTIVE',
    parameters: { initialTransactions: 5 },
  } as RuleInstance),
}

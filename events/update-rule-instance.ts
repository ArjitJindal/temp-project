export const event = {
  resource: '/rule_instances',
  path: '/rule_instances',
  httpMethod: 'PUT',
  headers: {},
  queryStringParameters: {
    tenantId: 'test-tenant-id',
  },
  pathParameters: {
    id: '34d0c2a7-8bf3-49b4-b0db-1c2965916139',
  },
  stageVariables: null,
  body: JSON.stringify({
    ruleId: 'R-1',
    status: 'ACTIVE',
    parameters: { initialTransactions: 10 },
  }),
}

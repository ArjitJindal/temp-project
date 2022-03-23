export const event = {
  resource: '/rules/{ruleId}',
  path: '/rules/R-1',
  httpMethod: 'DELETE',
  requestContext: { authorizer: { principalId: 'test-tenant-id' } },
  pathParameters: {
    ruleId: 'R-2',
  },
}

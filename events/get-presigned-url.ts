export const event = {
  resource: '/transactions',
  path: '/import/getPresignedUrl',
  httpMethod: 'POST',
  headers: {},
  requestContext: {
    accountId: 'test',
    authorizer: { principalId: 'test-tenant-id' },
  },
  stageVariables: null,
}

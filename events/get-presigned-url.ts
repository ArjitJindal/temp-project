export const event = {
  resource: '/transactions',
  path: '/files/getPresignedUrl',
  httpMethod: 'POST',
  headers: {},
  requestContext: {
    accountId: 'test',
    authorizer: { principalId: 'test-tenant-id' },
  },
  stageVariables: null,
}

import { ImportRequest } from '@/@types/openapi-internal/ImportRequest'

export const event = {
  resource: '/import',
  path: '/import',
  httpMethod: 'POST',
  headers: {},
  requestContext: {
    authorizer: {
      principalId: 'test-tenant-id',
      tenantName: 'test-tenant-name',
    },
  },
  stageVariables: null,
  body: JSON.stringify({
    type: 'TRANSACTION',
    format: 'flagright',
    // Copy the testing file to /tmp/flagright/s3/tarpon-tmp first
    s3Key: 'transaction.csv',
  } as ImportRequest),
}

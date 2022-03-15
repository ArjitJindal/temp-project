import { ImportRequest } from '../src/@types/openapi-internal/ImportRequest'

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
    // Copy the testing file to /tmp/.flagright/s3/tarpon-import-tmp first
    s3Key: 'test.csv',
  } as ImportRequest),
}

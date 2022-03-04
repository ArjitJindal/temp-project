import { ImportRequest } from '../src/@types/openapi-internal/importRequest'

export const event = {
  resource: '/import',
  path: '/import',
  httpMethod: 'POST',
  headers: {},
  requestContext: { authorizer: { principalId: 'test-tenant-id' } },
  stageVariables: null,
  body: JSON.stringify({
    type: ImportRequest.TypeEnum.Transaction,
    format: ImportRequest.FormatEnum.Flagright,
    // Copy the testing file to /tmp/.flagright/s3/tarpon-import-tmp first
    s3Key: 'test.csv',
  } as ImportRequest),
}

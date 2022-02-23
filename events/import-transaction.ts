import { TransactionImportRequest } from '../src/@types/openapi-internal/transactionImportRequest'

export const event = {
  resource: '/import',
  path: '/import',
  httpMethod: 'POST',
  headers: {},
  requestContext: { authorizer: { principalId: 'test-tenant-id' } },
  stageVariables: null,
  body: JSON.stringify({
    type: TransactionImportRequest.TypeEnum.Transaction,
    format: TransactionImportRequest.FormatEnum.Flagright,
    // Copy the testing file to /tmp/.flagright/s3/tarpon-import-tmp first
    s3Key: 'test.csv',
  } as TransactionImportRequest),
}

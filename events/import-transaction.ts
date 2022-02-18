import { TransactionImportRequest } from '../src/file-import/transaction/importer'

export const event = {
  resource: '/import',
  path: '/import',
  httpMethod: 'POST',
  headers: {},
  queryStringParameters: {
    tenantId: 'sh-payment',
  },
  stageVariables: null,
  body: JSON.stringify({
    type: 'TRANSACTION',
    format: 'sh-payment',
    // Copy the testing file to /tmp/.flagright/s3/tarpon-import-tmp first
    key: 'test.csv',
  } as TransactionImportRequest),
}

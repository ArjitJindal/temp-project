import { DefaultApiGetTransactionsListRequest } from '../src/@types/openapi-internal/RequestParameters'

export const event = {
  httpMethod: 'GET',
  headers: {},
  requestContext: {
    authorizer: { principalId: 'fake-demo-tenant-id-1', userId: 'test' },
  },
  queryStringParameters: {
    limit: 1,
    skip: 1,
    beforeTimestamp: 100000000000,
  } as DefaultApiGetTransactionsListRequest,
}

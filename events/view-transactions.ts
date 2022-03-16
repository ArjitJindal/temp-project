import { DefaultApiGetTransactionsListRequest } from '../src/@types/openapi-internal/RequestParameters'

export const event = {
  httpMethod: 'GET',
  headers: {},
  requestContext: { authorizer: { principalId: 'test' } },
  queryStringParameters: {
    limit: 1,
    skip: 1,
    beforeTimestamp: 100000000000,
  } as DefaultApiGetTransactionsListRequest,
}

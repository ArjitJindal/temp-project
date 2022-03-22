import { Comment } from '../src/@types/openapi-internal/Comment'

export const event = {
  httpMethod: 'POST',
  headers: {},
  requestContext: {
    authorizer: { principalId: 'test', userId: 'test-user-id' },
  },
  pathParameters: {
    transactionId: 'e482a539eea6e38acbd2d458e5573482',
  },
  body: JSON.stringify({
    body: 'Hello Comment!',
  } as Comment),
}

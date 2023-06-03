import { TestApiEvent, TestApiRequestContext } from './types'
import { Comment } from '@/@types/openapi-internal/Comment'

export const event: TestApiEvent = {
  httpMethod: 'POST',
  headers: {},
  requestContext: {
    authorizer: {
      principalId: 'test',
      userId: 'test-user-id',
    },
  } as TestApiRequestContext,
  pathParameters: {
    transactionId: 'e482a539eea6e38acbd2d458e5573482',
  },
  body: JSON.stringify({
    body: 'Hello Comment!',
  } as Comment),
}

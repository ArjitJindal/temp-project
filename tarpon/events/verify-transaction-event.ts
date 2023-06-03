import { TestApiEvent, TestApiRequestContext } from './types'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'

export const event: TestApiEvent = {
  resource: '/transactions',
  path: '/transactions',
  httpMethod: 'POST',
  headers: {},
  requestContext: {
    authorizer: { principalId: 'test-tenant-id' },
  } as TestApiRequestContext,
  stageVariables: null,
  body: JSON.stringify({
    transactionId: '7b80a539eea6e78acbd6d458e5971482',
    timestamp: Date.now(),
    transactionState: 'SUCCESSFUL',
    updatedTransactionAttributes: { reference: 'updated reference' },
  } as TransactionEvent),
}

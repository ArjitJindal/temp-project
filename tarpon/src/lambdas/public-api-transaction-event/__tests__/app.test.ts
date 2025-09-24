import { transactionEventHandler } from '../app'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import {
  getApiGatewayGetEvent,
  getApiGatewayPostEvent,
} from '@/test-utils/apigateway-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { transactionHandler } from '@/lambdas/public-api-transaction/app'
import {
  getTestTransaction,
  withAsyncRulesSync,
} from '@/test-utils/transaction-test-utils'
import { getTestTransactionEvent } from '@/test-utils/transaction-event-test-utils'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { setUpUsersHooks, getTestUser } from '@/test-utils/user-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withLocalChangeHandler } from '@/utils/local-change-handler'
import { Feature } from '@/@types/openapi-internal/Feature'

const features: Feature[] = ['RISK_LEVELS', 'RISK_SCORING']

withFeatureHook(features)
dynamoDbSetupHook()
withLocalChangeHandler()
withAsyncRulesSync()

async function createTransactionEvent(
  tenantId: string,
  transaction: Transaction,
  transactionEvent: TransactionEvent
) {
  await transactionHandler(
    getApiGatewayPostEvent(tenantId, '/transactions', transaction, {
      queryStringParameters: {
        validateOriginUserId: 'false',
        validateDestinationUserId: 'false',
      },
    }),
    null as any,
    null as any
  )
  return transactionEventHandler(
    getApiGatewayPostEvent(tenantId, '/events/transaction', transactionEvent),
    null as any,
    null as any
  )
}

describe('Public API - Create a Transaction Event', () => {
  const TEST_TENANT_ID = getTestTenantId()

  test('throws if transaction not found', async () => {
    const transactionEvent = getTestTransactionEvent({
      eventId: '1',
      transactionId: 'foo',
      transactionState: 'SUCCESSFUL',
      updatedTransactionAttributes: undefined,
    })
    const response = await transactionEventHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/events/transaction', {
        ...transactionEvent,
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(404)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      error: 'NotFoundError',
      message: `Transaction foo not found`,
    })
  })

  test('returns updated transaction and rule execution result', async () => {
    const transaction = getTestTransaction({
      transactionId: 'foo',
      transactionState: 'CREATED',
      timestamp: 100,
    })
    const transactionEvent = getTestTransactionEvent({
      eventId: 'event1',
      transactionId: 'foo',
      transactionState: 'DECLINED',
      updatedTransactionAttributes: {
        originPaymentDetails: {
          method: 'CARD',
        },
      },
    })
    const response = await createTransactionEvent(
      TEST_TENANT_ID,
      transaction,
      transactionEvent
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      eventId: 'event1',
      transaction: {
        ...transaction,
        transactionState: 'DECLINED',
        timestamp: 100,
        originPaymentDetails: {
          method: 'CARD',
        },
      },
      executedRules: [],
      hitRules: [],
    })
  })

  test('drop unknown fields', async () => {
    const transaction = getTestTransaction({
      transactionId: 'foo',
      originUserId: undefined,
      destinationUserId: undefined,
    })
    await transactionHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/transactions', transaction),
      null as any,
      null as any
    )
    const transactionEvent = getTestTransactionEvent({
      eventId: '1',
      transactionId: 'foo',
    })
    ;(transactionEvent as any).foo = 'bar'
    ;(transactionEvent.updatedTransactionAttributes as any).foo = 'bar'
    await transactionEventHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/events/transaction',
        transactionEvent
      ),
      null as any,
      null as any
    )
    const transactionEventRepository = new TransactionEventRepository(
      TEST_TENANT_ID,
      { dynamoDb: getDynamoDbClient() }
    )
    const savedEvent = (
      await transactionEventRepository.getTransactionEvents('foo')
    ).find((e) => e.eventId === '1')
    expect(savedEvent).not.toMatchObject({
      foo: 'bar',
    })
    expect(savedEvent?.updatedTransactionAttributes).not.toMatchObject({
      foo: 'bar',
    })
  })
})

describe('Public API - Batch create transaction events', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpUsersHooks(TEST_TENANT_ID, [
    getTestUser({ userId: '1' }),
    getTestUser({ userId: '2' }),
  ])

  test('successfully import transaction events', async () => {
    await transactionHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/batch/transactions', {
        batchId: 'b1',
        data: [
          getTestTransaction({
            transactionId: 'T-1',
            originUserId: '1',
            destinationUserId: '2',
          }),
          getTestTransaction({
            transactionId: 'T-2',
            originUserId: '1',
            destinationUserId: '2',
          }),
        ],
      }),
      null as any,
      null as any
    )
    const response = await transactionEventHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/batch/events/transaction', {
        batchId: 'b1',
        data: [
          getTestTransactionEvent({
            transactionId: 'T-1',
          }),
          getTestTransactionEvent({
            transactionId: 'T-2',
          }),
        ],
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toEqual({
      batchId: 'b1',
      failed: 0,
      successful: 2,
      status: 'SUCCESS',
    })
  })

  test('failed to import transaction events', async () => {
    const response = await transactionEventHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/batch/events/transaction', {
        batchId: 'b1',
        data: [
          getTestTransactionEvent({
            eventId: 'E-1',
            transactionId: 'T-3',
          }),
          getTestTransactionEvent({
            eventId: 'E-2',
            transactionId: 'T-4',
          }),
        ],
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toEqual({
      batchId: 'b1',
      failed: 2,
      failedRecords: [
        {
          id: 'T-3',
          reasonCode: 'ID_NOT_FOUND',
        },
        {
          id: 'T-4',
          reasonCode: 'ID_NOT_FOUND',
        },
      ],
      successful: 0,
      status: 'FAILURE',
      message: '2 of 2 records failed validation',
    })
  })
})

describe('Public API - Retrieve a Transaction Event', () => {
  const TEST_TENANT_ID = getTestTenantId()
  test('throws if transaction event not found', async () => {
    const response = await transactionEventHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/events/transaction/{eventId}', {
        pathParameters: { eventId: 'foo' },
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(404)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      error: 'NotFoundError',
      message: `Transaction event foo not found`,
    })
  })
  test('returns the transaction event', async () => {
    const transaction = getTestTransaction({
      transactionId: 'bar',
      timestamp: 100,
    })
    const transactionEvent = getTestTransactionEvent({
      eventId: 'foo',
      transactionId: 'bar',
      transactionState: 'DECLINED',
      updatedTransactionAttributes: {
        originPaymentDetails: {
          method: 'CARD',
        },
      },
    })
    await createTransactionEvent(TEST_TENANT_ID, transaction, transactionEvent)
    const response = await transactionEventHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/events/transaction/{eventId}', {
        pathParameters: { eventId: 'foo' },
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toMatchObject(transactionEvent)
  })
})

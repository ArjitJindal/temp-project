import { transactionHandler } from '../app'
import { setUpRulesHooks } from '@/test-utils/rule-test-utils'
import { setUpUsersHooks, getTestUser } from '@/test-utils/user-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import {
  getTestTransaction,
  withAsyncRulesSync,
} from '@/test-utils/transaction-test-utils'
import {
  getApiGatewayGetEvent,
  getApiGatewayPostEvent,
} from '@/test-utils/apigateway-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withLocalChangeHandler } from '@/utils/local-change-handler'
import { Feature } from '@/@types/openapi-internal/Feature'

const features: Feature[] = ['RISK_LEVELS', 'RISK_SCORING']

withFeatureHook(features)
dynamoDbSetupHook()
withLocalChangeHandler()
withAsyncRulesSync()

describe('Public API - Verify a transaction', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpUsersHooks(TEST_TENANT_ID, [
    getTestUser({ userId: '1' }),
    getTestUser({ userId: '2' }),
  ])
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'TEST-R-1',
      ruleImplementationName: 'tests/test-success-rule',
      type: 'TRANSACTION',
    },
    {
      id: 'TEST-R-2',
      ruleImplementationName: 'tests/test-success-rule',
      type: 'TRANSACTION',
      ruleRunMode: 'SHADOW',
      ruleExecutionMode: 'SYNC',
    },
  ])

  test("throws if origin user doesn't exist", async () => {
    const transaction = getTestTransaction({
      transactionId: 'dummy',
      originUserId: 'ghost',
    })
    const response = await transactionHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/transactions', transaction, {
        queryStringParameters: {
          validateOriginUserId: 'true',
          validateDestinationUserId: 'false',
        },
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(400)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      error: 'BadRequestError',
      message: 'originUserId: ghost does not exist',
    })
  })

  test("throws if destination user doesn't exist", async () => {
    const transaction = getTestTransaction({
      transactionId: 'dummy',
      originUserId: 'ghost1',
      destinationUserId: 'ghost2',
    })
    const response = await transactionHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/transactions', transaction, {
        queryStringParameters: {
          validateOriginUserId: 'false',
          validateDestinationUserId: 'true',
        },
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(400)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      error: 'BadRequestError',
      message: 'destinationUserId: ghost2 does not exist',
    })
  })

  test("throws if related transactions don't exist", async () => {
    const transaction = getTestTransaction({
      transactionId: 'dummy',
      relatedTransactionIds: ['foo'],
    })
    const response = await transactionHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/transactions', transaction, {
        queryStringParameters: {
          validateOriginUserId: 'false',
          validateDestinationUserId: 'false',
        },
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(400)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      error: 'BadRequestError',
      message: `Transaction with ID(s): foo do not exist.`,
    })
  })

  test('returns rules result', async () => {
    const relatedTransaction = getTestTransaction({
      transactionId: 'related-transaction',
      originUserId: '1',
      destinationUserId: '2',
    })
    await transactionHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/transactions',
        relatedTransaction
      ),
      null as any,
      null as any
    )
    const transaction = getTestTransaction({
      transactionId: 'dummy',
      originUserId: '1',
      destinationUserId: '2',
      relatedTransactionIds: ['related-transaction'],
    })
    const response = await transactionHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/transactions', transaction),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      transactionId: 'dummy',
      executedRules: [
        {
          ruleId: 'TEST-R-1',
          ruleInstanceId: expect.any(String),
          ruleName: 'test rule name',
          ruleDescription: '',
          ruleAction: 'FLAG',
          ruleHit: true,
          ruleHitMeta: {
            hitDirections: ['ORIGIN', 'DESTINATION'],
          },
        },
      ],
      hitRules: [
        {
          ruleId: 'TEST-R-1',
          ruleInstanceId: expect.any(String),
          ruleName: 'test rule name',
          ruleDescription: '',
          ruleAction: 'FLAG',
          ruleHitMeta: {
            hitDirections: ['ORIGIN', 'DESTINATION'],
          },
        },
      ],
    })
  })

  test('drop unknown fields', async () => {
    const transaction = getTestTransaction({
      originUserId: undefined,
      destinationUserId: undefined,
    })
    await transactionHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/transactions', {
        ...transaction,
        foo: 'bar',
      }),
      null as any,
      null as any
    )
    const transactionRepository = new DynamoDbTransactionRepository(
      TEST_TENANT_ID,
      getDynamoDbClient()
    )
    expect(
      await transactionRepository.getTransactionById(transaction.transactionId)
    ).not.toMatchObject({
      foo: 'bar',
    })
  })
})

describe('Public API - Batch create transactions', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpUsersHooks(TEST_TENANT_ID, [
    getTestUser({ userId: '1' }),
    getTestUser({ userId: '2' }),
  ])

  test('successfully import transactions', async () => {
    const response = await transactionHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/batch/transactions',
        {
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
        },
        {
          queryStringParameters: {
            validateOriginUserId: 'true',
            validateDestinationUserId: 'true',
          },
        }
      ),
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

  test('failed to import transactions', async () => {
    const response = await transactionHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/batch/transactions',
        {
          batchId: 'b1',
          data: [
            getTestTransaction({
              transactionId: 'T-3',
              originUserId: 'ghost',
              destinationUserId: 'ghost',
            }),
            getTestTransaction({
              transactionId: 'T-4',
              originUserId: 'ghost',
              destinationUserId: 'ghost',
            }),
          ],
        },
        {
          queryStringParameters: {
            validateOriginUserId: 'true',
            validateDestinationUserId: 'true',
          },
        }
      ),
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
          reasonCode: 'ORIGIN_USER_ID_NOT_FOUND',
        },
        {
          id: 'T-4',
          reasonCode: 'ORIGIN_USER_ID_NOT_FOUND',
        },
      ],
      successful: 0,
      status: 'FAILURE',
      message: '2 of 2 records failed validation',
    })
  })
})

describe('Public API - Retrieve a Transaction', () => {
  const TEST_TENANT_ID = getTestTenantId()

  test('throws if transaction not found', async () => {
    const response = await transactionHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/transactions/{transactionId}', {
        pathParameters: {
          transactionId: 'dummy',
        },
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(404)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      error: 'NotFoundError',
      message: `Transaction dummy not found`,
    })
  })

  test('returns the transaction', async () => {
    const transaction = getTestTransaction({ transactionId: 'foo' })
    await transactionHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/transactions', transaction, {
        queryStringParameters: {
          validateOriginUserId: 'false',
          validateDestinationUserId: 'false',
        },
      }),
      null as any,
      null as any
    )
    const response = await transactionHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/transactions/{transactionId}', {
        pathParameters: {
          transactionId: 'foo',
        },
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toEqual({
      ...transaction,
      status: 'ALLOW',
      executedRules: [],
      hitRules: [],
      riskScoreDetails: {
        trsRiskLevel: 'VERY_HIGH',
        trsScore: 90,
      },
      updateCount: expect.any(Number),
    })
  })
})

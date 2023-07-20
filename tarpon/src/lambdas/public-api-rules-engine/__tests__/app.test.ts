import {
  transactionEventHandler,
  transactionHandler,
  userEventsHandler,
} from '../app'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  getApiGatewayGetEvent,
  getApiGatewayPostEvent,
} from '@/test-utils/apigateway-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  getTestBusiness,
  getTestUser,
  setUpUsersHooks,
} from '@/test-utils/user-test-utils'
import { setUpRulesHooks } from '@/test-utils/rule-test-utils'
import { getTestTransactionEvent } from '@/test-utils/transaction-event-test-utils'
import {
  getTestBusinessEvent,
  getTestUserEvent,
} from '@/test-utils/user-event-test-utils'
import { userHandler } from '@/lambdas/public-api-user-management/app'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { TEST_VARIABLE_RISK_ITEM } from '@/test-utils/pulse-test-utils'
import { ParameterAttributeRiskValuesParameterEnum } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { Feature } from '@/@types/openapi-internal/Feature'
import { RiskScoringService } from '@/services/risk-scoring'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { UserService } from '@/lambdas/console-api-user/services/user-service'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { getS3Client } from '@/utils/s3'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { UserEventRepository } from '@/services/rules-engine/repositories/user-event-repository'
import { ConsumerUserEvent } from '@/@types/openapi-internal/ConsumerUserEvent'
import { BusinessUserEvent } from '@/@types/openapi-internal/BusinessUserEvent'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'
import {
  disableLocalChangeHandler,
  enableLocalChangeHandler,
} from '@/utils/local-dynamodb-change-handler'

const features: Feature[] = ['PULSE']

withFeatureHook(features)
dynamoDbSetupHook()

describe('Public API - Verify a transaction', () => {
  const TEST_TENANT_ID = getTestTenantId()
  beforeAll(() => {
    enableLocalChangeHandler()
  })
  afterAll(() => {
    disableLocalChangeHandler()
  })
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
          ruleDescription: 'test rule description.',
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
          ruleDescription: 'test rule description.',
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

describe('Public API - Retrieve a Transaction', () => {
  const TEST_TENANT_ID = getTestTenantId()

  test('throws if transaction not found', async () => {
    const response = await transactionHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/transactions', {
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
      getApiGatewayGetEvent(TEST_TENANT_ID, '/transactions', {
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
    })
  })
})

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
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/events/transaction',
        transactionEvent
      ),
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
    const response = await transactionEventHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/events/transaction',
        transactionEvent
      ),
      null as any,
      null as any
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

describe('Public API - Create a Consumer User Event', () => {
  const TEST_TENANT_ID = getTestTenantId()

  test('throws if user not found', async () => {
    const userEvent = getTestUserEvent({ userId: 'foo' })
    const response = await userEventsHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/events/consumer/user',
        userEvent
      ),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(404)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      error: 'NotFoundError',
      message: 'User foo not found. Please create the user foo',
    })
  })

  test('returns updated user', async () => {
    const consumerUser = getTestUser({ userId: 'foo' })
    await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/consumer/users', consumerUser),
      null as any,
      null as any
    )
    const userEvent = getTestUserEvent({
      eventId: '1',
      userId: 'foo',
      updatedConsumerUserAttributes: {
        tags: [{ key: 'key', value: 'value' }],
      },
    })
    const response = await userEventsHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/events/consumer/user',
        userEvent
      ),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toEqual({
      ...consumerUser,
      tags: [{ key: 'key', value: 'value' }],
      status: 'ALLOW',
      executedRules: [],
      hitRules: [],
    })
  })

  test('Converts from Business user to a Consumer user', async () => {
    const businessUser = getTestBusiness({ userId: 'business-user-1' })
    await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/business/users', businessUser),
      null as any,
      null as any
    )
    const userEvent = getTestUserEvent({
      eventId: '1',
      userId: 'business-user-1',
      updatedConsumerUserAttributes: {
        tags: [{ key: 'key', value: 'value' }],
      },
    })
    const response = await userEventsHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/events/consumer/user',
        userEvent,
        {
          queryStringParameters: {
            allowUserTypeConversion: 'true',
          },
        }
      ),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toEqual({
      userId: businessUser.userId,
      createdTimestamp: businessUser.createdTimestamp,
      tags: [{ key: 'key', value: 'value' }],
      executedRules: [],
      hitRules: [],
      status: 'ALLOW',
    })
  })

  test('Forbid converting to a consumer user if allowUserConversion is not set', async () => {
    const businessUser = getTestBusiness({ userId: 'business-user-2' })
    await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/business/users', businessUser),
      null as any,
      null as any
    )
    const userEvent = getTestUserEvent({
      eventId: '1',
      userId: 'business-user-2',
      updatedConsumerUserAttributes: {
        tags: [{ key: 'key', value: 'value' }],
      },
    })
    const response = await userEventsHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/events/consumer/user',
        userEvent
      ),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(400)
  })

  test('drop unknown fields', async () => {
    const consumerUser = getTestUser({ userId: 'foo' })
    await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/consumer/users', consumerUser),
      null as any,
      null as any
    )
    const userEvent = getTestUserEvent({
      eventId: '1',
      userId: 'foo',
      updatedConsumerUserAttributes: {
        tags: [{ key: 'key', value: 'value' }],
      },
    })
    ;(userEvent.updatedConsumerUserAttributes as any).foo = 'bar'
    ;(userEvent as any).foo = 'bar'
    await userEventsHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/events/consumer/user',
        userEvent
      ),
      null as any,
      null as any
    )
    const userEventRepository = new UserEventRepository(TEST_TENANT_ID, {
      dynamoDb: getDynamoDbClient(),
    })
    const savedEvent = (
      await userEventRepository.getConsumerUserEvents('foo')
    ).find((e) => e.eventId === '1')
    expect(savedEvent).not.toMatchObject({
      foo: 'bar',
    })
    expect(
      (savedEvent as ConsumerUserEvent).updatedConsumerUserAttributes
    ).not.toMatchObject({
      foo: 'bar',
    })
  })
})

describe('Public API - Create a Business User Event', () => {
  const TEST_TENANT_ID = getTestTenantId()
  beforeAll(() => {
    enableLocalChangeHandler()
  })
  afterAll(() => {
    disableLocalChangeHandler()
  })
  test('throws if user not found', async () => {
    const userEvent = getTestBusinessEvent({ userId: 'foo' })
    const response = await userEventsHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/events/business/user',
        userEvent
      ),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(404)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      error: 'NotFoundError',
      message: 'User foo not found. Please create the user foo',
    })
  })

  test('returns updated user', async () => {
    const user = getTestBusiness({ userId: 'foo' })
    const mongoDb = await getMongoDbClient()
    await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/business/users', user),
      null as any,
      null as any
    )
    const userEvent = getTestBusinessEvent({
      eventId: '1',
      userId: 'foo',
      updatedBusinessUserAttributes: {
        tags: [{ key: 'key', value: 'value' }],
        legalEntity: {
          companyGeneralDetails: {
            legalName: 'legalName',
          },
        },
      },
    })
    const response = await userEventsHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/events/business/user',
        userEvent
      ),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    const toMatchObject = {
      ...user,
      tags: [{ key: 'key', value: 'value' }],
      legalEntity: {
        companyGeneralDetails: {
          legalName: 'legalName',
        },
      },
      status: 'ALLOW',
      executedRules: [],
      hitRules: [],
    }
    expect(JSON.parse(response?.body as string)).toEqual(toMatchObject)
    const userService = new UserService(
      TEST_TENANT_ID,
      { mongoDb },
      getS3Client({
        accessKeyId: 'accessKeyId',
        secretAccessKey: 'secretAccessKey',
      }),
      '',
      ''
    )
    const businessUserMongo = await userService.getBusinessUser('foo')
    expect(businessUserMongo).toMatchObject(toMatchObject)
    const dynamoDb = getDynamoDbClient()
    const userRepository = new UserRepository(TEST_TENANT_ID, { dynamoDb })
    const businessUserDynamo = await userRepository.getBusinessUser('foo')
    expect(businessUserDynamo).toMatchObject(toMatchObject)
  })

  test('Converts from Consumer user to a Business user', async () => {
    const consumerUser = getTestUser({ userId: 'consumer-user-1' })
    await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/consumer/users', consumerUser),
      null as any,
      null as any
    )
    const userEvent = getTestBusinessEvent({
      eventId: '1',
      userId: 'consumer-user-1',
      updatedBusinessUserAttributes: {
        legalEntity: { companyGeneralDetails: { legalName: 'Test Business' } },
      },
    })
    const response = await userEventsHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/events/business/user',
        userEvent,
        {
          queryStringParameters: {
            allowUserTypeConversion: 'true',
          },
        }
      ),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toEqual({
      userId: consumerUser.userId,
      createdTimestamp: consumerUser.createdTimestamp,
      legalEntity: { companyGeneralDetails: { legalName: 'Test Business' } },
      executedRules: [],
      hitRules: [],
      status: 'ALLOW',
    })
  })

  test('Forbid converting to a business user if allowUserConversion is not set', async () => {
    const consumerUser = getTestUser({ userId: 'consumer-user-2' })
    await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/consumer/users', consumerUser),
      null as any,
      null as any
    )
    const userEvent = getTestBusinessEvent({
      eventId: '1',
      userId: 'consumer-user-2',
      updatedBusinessUserAttributes: {
        legalEntity: { companyGeneralDetails: { legalName: 'Test Business' } },
      },
    })
    const response = await userEventsHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/events/business/user',
        userEvent
      ),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(400)
  })

  test('drop unknown fields', async () => {
    const user = getTestBusiness({ userId: 'foo' })
    await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/business/users', user),
      null as any,
      null as any
    )
    const userEvent = getTestBusinessEvent({
      eventId: '1',
      userId: 'foo',
      updatedBusinessUserAttributes: {
        tags: [{ key: 'key', value: 'value' }],
      },
    })
    ;(userEvent.updatedBusinessUserAttributes as any).foo = 'bar'
    ;(userEvent as any).foo = 'bar'
    await userEventsHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/events/business/user',
        userEvent
      ),
      null as any,
      null as any
    )
    const userEventRepository = new UserEventRepository(TEST_TENANT_ID, {
      dynamoDb: getDynamoDbClient(),
    })
    const savedEvent = (
      await userEventRepository.getBusinessUserEvents('foo')
    ).find((e) => e.eventId === '1')
    expect(savedEvent).not.toMatchObject({
      foo: 'bar',
    })
    expect(
      (savedEvent as BusinessUserEvent).updatedBusinessUserAttributes
    ).not.toMatchObject({
      foo: 'bar',
    })
  })
})

describe('Risk Scoring Tests', () => {
  beforeAll(() => {
    enableLocalChangeHandler()
  })
  afterAll(() => {
    disableLocalChangeHandler()
  })
  const TEST_TENANT_ID = getTestTenantId()
  const dynamoDb = getDynamoDbClient()

  const testUser1 = getTestUser({ userId: 'userId1' })
  const testUser2 = getTestUser({ userId: 'userId2' })
  setUpUsersHooks(TEST_TENANT_ID, [testUser1, testUser2])

  it('check on isUpdatable is true risk score changes', async () => {
    const mongoDb = await getMongoDbClient()
    const riskRepository = new RiskRepository(TEST_TENANT_ID, {
      dynamoDb,
      mongoDb,
    })
    await riskRepository.createOrUpdateParameterRiskItem(
      TEST_VARIABLE_RISK_ITEM
    )
    const riskScoringService = new RiskScoringService(TEST_TENANT_ID, {
      dynamoDb,
      mongoDb: await getMongoDbClient(),
    })
    await riskScoringService.updateInitialRiskScores(testUser1)
    const riskScore = await riskRepository.getParameterRiskItem(
      'originAmountDetails.country' as ParameterAttributeRiskValuesParameterEnum,
      'TRANSACTION'
    )

    expect(riskScore).toEqual(TEST_VARIABLE_RISK_ITEM)
    const allRiskScores = await riskRepository.getParameterRiskItems()

    expect(allRiskScores).toEqual([
      expect.objectContaining(TEST_VARIABLE_RISK_ITEM),
    ])

    const testTransaction1 = getTestTransaction({
      originUserId: testUser1.userId,
      destinationUserId: testUser2.userId,
      originAmountDetails: {
        country: 'IN',
        transactionAmount: 10000000,
        transactionCurrency: 'INR',
      },
    })

    await transactionHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/transactions', testTransaction1),
      null as any,
      null as any
    )

    const getRiskScore = await riskRepository.getDrsScore(testUser1.userId)

    expect(getRiskScore).toEqual(
      expect.objectContaining({
        isUpdatable: true,
        drsScore: 70,
        userId: testUser1.userId,
        transactionId: testTransaction1.transactionId,
      })
    )
  })
  it("shouldn't update the risk score on isUpdatable is false", async () => {
    const mongoDb = await getMongoDbClient()
    const riskRepository = new RiskRepository(TEST_TENANT_ID, {
      dynamoDb,
      mongoDb,
    })
    await riskRepository.createOrUpdateParameterRiskItem(
      TEST_VARIABLE_RISK_ITEM
    )
    const testTransaction1 = getTestTransaction({
      originUserId: testUser1.userId,
      destinationUserId: testUser2.userId,
      originAmountDetails: {
        country: 'IN',
        transactionAmount: 10000000,
        transactionCurrency: 'INR',
      },
    })

    await riskRepository.createOrUpdateManualDRSRiskItem(
      testUser1.userId,
      'MEDIUM',
      false
    )

    const oldScore = await riskRepository.getDrsScore(testUser1.userId)

    await transactionHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/transactions', testTransaction1),
      null as any,
      null as any
    )

    const getRiskScore = await riskRepository.getDrsScore(testUser1.userId)

    expect(getRiskScore).toEqual(
      expect.objectContaining({
        isUpdatable: false,
        drsScore: oldScore?.drsScore,
        userId: testUser1.userId,
      })
    )
  })
})

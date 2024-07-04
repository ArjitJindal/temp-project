import { v4 as uuidv4 } from 'uuid'
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
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { UserService } from '@/services/users'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { getS3Client } from '@/utils/s3'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { UserEventRepository } from '@/services/rules-engine/repositories/user-event-repository'
import { ConsumerUserEvent } from '@/@types/openapi-internal/ConsumerUserEvent'
import { BusinessUserEvent } from '@/@types/openapi-internal/BusinessUserEvent'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'
import { withLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { pickKnownEntityFields } from '@/utils/object'
import { User } from '@/@types/openapi-public/User'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { RulesEngineService } from '@/services/rules-engine'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'

const features: Feature[] = ['RISK_LEVELS', 'RISK_SCORING']

withFeatureHook(features)
dynamoDbSetupHook()
withLocalChangeHandler()

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
      mode: 'SHADOW_SYNC',
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
      riskScoreDetails: {
        trsRiskLevel: 'VERY_HIGH',
        trsScore: 90,
      },
    })
  })
})

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
    expect(JSON.parse(response?.body as string)).toEqual(transactionEvent)
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

    const mongoDb = await getMongoDbClient()
    const userRepository = new UserRepository(TEST_TENANT_ID, {
      mongoDb,
    })
    const internalConsumerUser = await userRepository.getUserById('foo')
    const internalConsumerUserWithComments = {
      ...internalConsumerUser,
      comments: [{ body: 'a comment' }],
    } as InternalUser
    await userRepository.saveUserMongo(internalConsumerUserWithComments)
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
      ...pickKnownEntityFields(consumerUser, User),
      riskLevel: 'VERY_HIGH',
      tags: [{ key: 'key', value: 'value' }],
      status: 'ALLOW',
      executedRules: [],
      hitRules: [],
      riskScoreDetails: {
        craRiskLevel: 'VERY_HIGH',
        craRiskScore: 90,
        kycRiskLevel: 'VERY_HIGH',
        kycRiskScore: 90,
      },
    })
    const mongoUser = await userRepository.getUserById('foo')
    expect(mongoUser).toEqual({
      ...internalConsumerUserWithComments,
      riskLevel: 'VERY_HIGH',
      updatedAt: expect.any(Number),
      tags: [{ key: 'key', value: 'value' }],
      riskScoreDetails: {
        craRiskLevel: 'VERY_HIGH',
        craRiskScore: 90,
        kycRiskLevel: 'VERY_HIGH',
        kycRiskScore: 90,
      },
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
      riskScoreDetails: {
        craRiskLevel: 'VERY_HIGH',
        craRiskScore: 90,
        kycRiskLevel: 'VERY_HIGH',
        kycRiskScore: 90,
      },
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

describe('Public API - Retrieve a Consumer User Event', () => {
  const TEST_TENANT_ID = getTestTenantId()
  test('throws if user event not found', async () => {
    const response = await userEventsHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/events/consumer/user/{eventId}', {
        pathParameters: { eventId: 'foo' },
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(404)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      error: 'NotFoundError',
      message: `User event foo not found`,
    })
  })
  test('returns the user event', async () => {
    const consumerUser = getTestUser({ userId: 'bar' })
    await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/consumer/users', consumerUser),
      null as any,
      null as any
    )
    const userEvent = getTestUserEvent({
      eventId: 'foo',
      userId: 'bar',
      updatedConsumerUserAttributes: {
        tags: [{ key: 'key', value: 'value' }],
      },
    })
    await userEventsHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/events/consumer/user',
        userEvent
      ),
      null as any,
      null as any
    )

    const response = await userEventsHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/events/consumer/user/{eventId}', {
        pathParameters: { eventId: 'foo' },
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toEqual(userEvent)
  })
})

describe('Public API - Create a Business User Event', () => {
  const TEST_TENANT_ID = getTestTenantId()

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
      riskLevel: 'VERY_HIGH',
      tags: [{ key: 'key', value: 'value' }],
      legalEntity: {
        companyGeneralDetails: {
          legalName: 'legalName',
        },
      },
      status: 'ALLOW',
      executedRules: [],
      hitRules: [],
      riskScoreDetails: {
        craRiskLevel: 'VERY_HIGH',
        craRiskScore: 90,
        kycRiskLevel: 'VERY_HIGH',
        kycRiskScore: 90,
      },
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
      riskScoreDetails: {
        craRiskLevel: 'VERY_HIGH',
        craRiskScore: 90,
        kycRiskLevel: 'VERY_HIGH',
        kycRiskScore: 90,
      },
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

describe('Public API - Retrieve a Business User Event', () => {
  const TEST_TENANT_ID = getTestTenantId()
  test('throws if user event not found', async () => {
    const response = await userEventsHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/events/business/user/{eventId}', {
        pathParameters: { eventId: 'foo' },
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(404)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      error: 'NotFoundError',
      message: `User event foo not found`,
    })
  })
  test('returns the user event', async () => {
    const user = getTestBusiness({ userId: 'bar' })
    await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/business/users', user),
      null as any,
      null as any
    )
    const userEvent = getTestBusinessEvent({
      eventId: 'foo',
      userId: 'bar',
      updatedBusinessUserAttributes: {
        tags: [{ key: 'key', value: 'value' }],
      },
    })
    await userEventsHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/events/business/user',
        userEvent
      ),
      null as any,
      null as any
    )

    const response = await userEventsHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/events/business/user/{eventId}', {
        pathParameters: { eventId: 'foo' },
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toEqual(userEvent)
  })
})

describe('Risk Scoring Tests', () => {
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

describe('Public API - Verify Transction and Transaction Event', () => {
  const tenantId = getTestTenantId()
  const userId1 = uuidv4()
  const userId2 = uuidv4()

  setUpUsersHooks(tenantId, [
    getTestUser({ userId: userId1 }),
    getTestUser({ userId: userId2 }),
  ])

  it('should match transaction and transaction event', async () => {
    const transaction = getTestTransaction({
      originUserId: userId1,
      destinationUserId: userId2,
    })

    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
    const rulesEngine = new RulesEngineService(tenantId, dynamoDb, mongoDb)

    await rulesEngine.verifyTransaction(transaction)

    const dynamoDbTransactionRepository = new DynamoDbTransactionRepository(
      tenantId,
      dynamoDb
    )

    const transactionResult =
      await dynamoDbTransactionRepository.getTransactionById(
        transaction.transactionId
      )

    expect(transactionResult).toEqual({
      ...transaction,
      executedRules: [],
      hitRules: [],
      status: 'ALLOW',
      riskScoreDetails: {
        trsRiskLevel: 'VERY_HIGH',
        trsScore: 90,
      },
    })

    const mongoDbTransactionRepository = new MongoDbTransactionRepository(
      tenantId,
      mongoDb
    )

    const mongoTransactionResult =
      await mongoDbTransactionRepository.getTransactionById(
        transaction.transactionId
      )

    expect(mongoTransactionResult).toMatchObject({
      ...transaction,
      executedRules: [],
      hitRules: [],
      status: 'ALLOW',
    })

    const transactionEvent = getTestTransactionEvent({
      transactionId: transaction.transactionId,
      transactionState: 'REFUNDED',
      eventDescription: 'Refunded',
      timestamp: Date.now(),
      updatedTransactionAttributes: {
        productType: 'test',
        originPaymentDetails: {
          method: 'ACH',
        },
        destinationAmountDetails: {
          transactionAmount: 1000000,
          transactionCurrency: 'INR',
        },
      },
    })

    await rulesEngine.verifyTransactionEvent(transactionEvent)

    const transactionEventRepository = new TransactionEventRepository(
      tenantId,
      { dynamoDb, mongoDb }
    )

    const transactionEvents =
      await transactionEventRepository.getTransactionEvents(
        transaction.transactionId
      )

    expect(transactionEvents).toMatchObject([
      {
        updatedTransactionAttributes: {
          destinationAmountDetails: {
            country: 'IN',
            transactionCurrency: 'INR',
            transactionAmount: 68351.34,
          },
          originUserId: userId1,
          originAmountDetails: {
            country: 'DE',
            transactionCurrency: 'EUR',
            transactionAmount: 800,
          },
          destinationPaymentDetails: {
            cardIssuedCountry: 'IN',
            '3dsDone': true,
            method: 'CARD',
            transactionReferenceField: 'DEPOSIT',
          },
          transactionState: 'SUCCESSFUL',
          transactionId: transaction.transactionId,
          destinationUserId: userId2,
          originPaymentDetails: {
            cardIssuedCountry: 'US',
            '3dsDone': true,
            method: 'CARD',
            transactionReferenceField: 'DEPOSIT',
          },
          promotionCodeUsed: true,
          timestamp: expect.any(Number),
        },
        hitRules: [],
        executedRules: [],
        transactionState: 'SUCCESSFUL',
        transactionId: transaction.transactionId,
        timestamp: expect.any(Number),
      },
      {
        updatedTransactionAttributes: {
          destinationAmountDetails: {
            transactionCurrency: 'INR',
            transactionAmount: 1000000,
          },
          productType: 'test',
          originPaymentDetails: {
            method: 'ACH',
          },
        },
        hitRules: [],
        executedRules: [],
        eventDescription: 'Refunded',
        transactionState: 'REFUNDED',
        transactionId: transaction.transactionId,
        timestamp: expect.any(Number),
      },
    ])

    const mongoTransactionAfterEvent =
      await mongoDbTransactionRepository.getTransactionById(
        transaction.transactionId
      )

    const toMatchObject = {
      originAmountDetails: {
        country: 'DE',
        transactionCurrency: 'EUR',
        transactionAmount: 800,
      },
      destinationPaymentDetails: {
        cardIssuedCountry: 'IN',
        cardFingerprint: expect.any(String),
        '3dsDone': true,
        method: 'CARD',
        transactionReferenceField: 'DEPOSIT',
      },
      transactionId: transaction.transactionId,
      destinationAmountDetails: {
        country: 'IN',
        transactionCurrency: 'INR',
        transactionAmount: 1000000,
      },
      hitRules: [],
      originUserId: userId1,
      executedRules: [],
      transactionState: 'REFUNDED',
      destinationUserId: userId2,
      originPaymentDetails: {
        cardIssuedCountry: 'US',
        cardFingerprint: expect.any(String),
        '3dsDone': true,
        method: 'ACH',
        transactionReferenceField: 'DEPOSIT',
      },
      productType: 'test',
      promotionCodeUsed: true,
      timestamp: expect.any(Number),
      status: 'ALLOW',
      originPaymentMethodId: null,
      destinationPaymentMethodId: expect.any(String),
      createdAt: expect.any(Number),
    }

    expect(mongoTransactionAfterEvent).toMatchObject(toMatchObject)

    const dynamoDbTransactionAfterEvent =
      await dynamoDbTransactionRepository.getTransactionById(
        transaction.transactionId
      )

    delete toMatchObject.createdAt
    delete toMatchObject.destinationPaymentMethodId
    delete (toMatchObject as any).originPaymentMethodId

    expect(dynamoDbTransactionAfterEvent).toMatchObject(toMatchObject)
  })
})

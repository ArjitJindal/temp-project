import { userHandler } from '../app'
import {
  getApiGatewayGetEvent,
  getApiGatewayPostEvent,
} from '@/test-utils/apigateway-test-utils'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { withFeatureHook } from '@/test-utils/feature-test-utils'

dynamoDbSetupHook()
withFeatureHook(['RISK_SCORING', 'RISK_LEVELS'])

const riskScoreDetails = {
  kycRiskLevel: 'VERY_HIGH',
  craRiskLevel: 'VERY_HIGH',
  kycRiskScore: 90,
  craRiskScore: 90,
}

describe('Public API - Create a Consumer User', () => {
  const TEST_TENANT_ID = getTestTenantId()

  test('returns saved user ID', async () => {
    const consumerUser = getTestUser({ userId: '1' })
    const response = await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/consumer/users', consumerUser),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      userId: '1',
      riskScoreDetails,
    })
  })

  test('returns userId and hint message if user already exists', async () => {
    const consumerUser = getTestUser({ userId: '2' })
    await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/consumer/users', consumerUser),
      null as any,
      null as any
    )
    const response = await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/consumer/users', consumerUser),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      userId: '2',
      message:
        'The provided userId already exists. The user attribute updates are not saved. If you want to update the attributes of this user, please use user events instead.',
      riskScoreDetails,
    })
  })

  test('drop unknown fields', async () => {
    const consumerUser = getTestUser({ userId: '3' })
    await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/consumer/users', {
        ...consumerUser,
        foo: 'bar',
      }),
      null as any,
      null as any
    )
    const userRepository = new UserRepository(TEST_TENANT_ID, {
      dynamoDb: getDynamoDbClient(),
    })
    expect(await userRepository.getUser('3')).not.toMatchObject({
      foo: 'bar',
    })
  })
})

describe('Public API - Create a Consumer User Batch', () => {
  const TEST_TENANT_ID = getTestTenantId()

  test('returns saved user ID', async () => {
    const consumerUser = getTestUser({ userId: '1' })
    const response = await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/batch/consumer/users', {
        data: [consumerUser],
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      message: 'Batch users processed',
    })
  })

  test('returns userId and hint message if user already exists', async () => {
    const consumerUser = getTestUser({ userId: '2' })
    await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/batch/consumer/users', {
        data: [consumerUser],
      }),
      null as any,
      null as any
    )
    const response = await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/batch/consumer/users', {
        data: [consumerUser],
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      message: 'Some users already exist: 2',
    })
  })
})

describe('Public API - Retrieve a Consumer User', () => {
  const TEST_TENANT_ID = getTestTenantId()

  test('throws if user not found', async () => {
    const response = await userHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/consumer/users/{userId}', {
        pathParameters: { userId: 'foo' },
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(404)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      error: 'NotFoundError',
      message: `User foo not found`,
    })
  })

  test('returns the requested user', async () => {
    const consumerUser = getTestUser({ userId: '1' })
    await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/consumer/users', consumerUser),
      null as any,
      null as any
    )
    const response = await userHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/consumer/users/{userId}', {
        pathParameters: { userId: '1' },
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      ...consumerUser,
      riskScoreDetails,
    })
  })
})

describe('Public API - Create a Business User', () => {
  const TEST_TENANT_ID = getTestTenantId()

  test('returns saved user ID', async () => {
    const business = getTestBusiness({ userId: '1' })
    const response = await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/business/users', business),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      userId: '1',
      riskScoreDetails,
    })
  })

  test('returns userId and hint message if user already exists', async () => {
    const business = getTestUser({ userId: '2' })
    await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/business/users', business),
      null as any,
      null as any
    )
    const response = await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/consumer/users', business),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      userId: '2',
      message:
        'The provided userId already exists. The user attribute updates are not saved. If you want to update the attributes of this user, please use user events instead.',
      riskScoreDetails,
    })
  })

  test('drop unknown fields', async () => {
    const business = getTestBusiness({ userId: '3' })
    await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/business/users', {
        ...business,
        foo: 'bar',
      }),
      null as any,
      null as any
    )
    const userRepository = new UserRepository(TEST_TENANT_ID, {
      dynamoDb: getDynamoDbClient(),
    })
    expect(await userRepository.getUser('3')).not.toMatchObject({
      foo: 'bar',
    })
  })
})

describe('Public API - Retrieve a Business User', () => {
  const TEST_TENANT_ID = getTestTenantId()

  test('throws if user not found', async () => {
    const response = await userHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/business/users/{userId}', {
        pathParameters: { userId: 'foo' },
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(404)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      error: 'NotFoundError',
      message: `User foo not found`,
    })
  })

  test('returns the requested user', async () => {
    const business = getTestBusiness({ userId: '1' })
    await userHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/business/users', business),
      null as any,
      null as any
    )
    const response = await userHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/business/users/{userId}', {
        pathParameters: { userId: '1' },
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      ...business,
      riskScoreDetails,
    })
  })
})

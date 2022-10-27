import { userHandler } from '../app'
import {
  getApiGatewayGetEvent,
  getApiGatewayPostEvent,
} from '@/test-utils/apigateway-test-utils'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'

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
    expect(JSON.parse(response?.body as string)).toEqual({
      userId: '1',
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
    expect(JSON.parse(response?.body as string)).toEqual({
      userId: '2',
      message:
        'The provided userId already exists. The user attribute updates are not saved. If you want to update the attributes of this user, please use user events instead.',
    })
  })
})

describe('Public API - Retrieve a Consumer User', () => {
  const TEST_TENANT_ID = getTestTenantId()

  test('throws if user not found', async () => {
    const response = await userHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/consumer/users', {
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
      getApiGatewayGetEvent(TEST_TENANT_ID, '/consumer/users', {
        pathParameters: { userId: '1' },
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toEqual(consumerUser)
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
    expect(JSON.parse(response?.body as string)).toEqual({
      userId: '1',
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
    expect(JSON.parse(response?.body as string)).toEqual({
      userId: '2',
      message:
        'The provided userId already exists. The user attribute updates are not saved. If you want to update the attributes of this user, please use user events instead.',
    })
  })
})

describe('Public API - Retrieve a Business User', () => {
  const TEST_TENANT_ID = getTestTenantId()

  test('throws if user not found', async () => {
    const response = await userHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/business/users', {
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
      getApiGatewayGetEvent(TEST_TENANT_ID, '/business/users', {
        pathParameters: { userId: '1' },
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toEqual(business)
  })
})

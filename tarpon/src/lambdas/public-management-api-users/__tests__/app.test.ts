import { userHandler } from '../app'
import { userHandler as userCreationHandler } from '@/lambdas/public-api-user-management/app'
import {
  getApiGatewayDeleteEvent,
  getApiGatewayGetEvent,
  getApiGatewayPostEvent,
} from '@/test-utils/apigateway-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestUser } from '@/test-utils/user-test-utils'
import { withLocalChangeHandler } from '@/utils/local-change-handler'

dynamoDbSetupHook()
withLocalChangeHandler()
describe('Public Management API - Users', () => {
  const consumerUser = getTestUser({ userId: '1' })
  test('tries to get a comment failed (not present)', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const COMMENT_ID = 'TEST_COMMENT_ID'
    const response = await userHandler(
      getApiGatewayGetEvent(
        TEST_TENANT_ID,
        '/users/{userId}/comments/{commentId}',
        {
          pathParameters: { userId: '1', commentId: COMMENT_ID },
        }
      ),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(404)
  })
  test('creates a comment', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const response0 = await userCreationHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/consumer/users', consumerUser),
      null as any,
      null as any
    )
    expect(response0?.statusCode).toBe(200)
    expect(JSON.parse(response0?.body as string)).toMatchObject({
      userId: '1',
    })
    const response1 = await userHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/users/{userId}/comments',
        {
          body: 'This is a comment',
        },
        {
          pathParameters: { userId: '1' },
        }
      ),

      null as any,
      null as any
    )
    expect(response1?.statusCode).toBe(200)
    expect(JSON.parse(response1?.body as string)).toMatchObject({
      body: 'This is a comment',
      files: [],
    })
  })

  test('gets all comments of a user', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const response0 = await userCreationHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/consumer/users', consumerUser),
      null as any,
      null as any
    )
    expect(response0?.statusCode).toBe(200)
    expect(JSON.parse(response0?.body as string)).toMatchObject({
      userId: '1',
    })
    const response1 = await userHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/users/{userId}/comments',
        {
          body: 'This is a comment',
        },
        {
          pathParameters: { userId: '1' },
        }
      ),

      null as any,
      null as any
    )
    expect(response1?.statusCode).toBe(200)
    expect(JSON.parse(response1?.body as string)).toMatchObject({
      body: 'This is a comment',
      files: [],
    })
    const response2 = await userHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/users/{userId}/comments', {
        pathParameters: { userId: '1' },
      }),
      null as any,
      null as any
    )
    expect(response2?.statusCode).toBe(200)
    expect(JSON.parse(response2?.body as string)).toMatchObject([
      {
        body: 'This is a comment',
        files: [],
      },
    ])
  })
  test('gets a comment', async () => {
    const TEST_TENANT_ID = getTestTenantId()

    const response0 = await userCreationHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/consumer/users', consumerUser),
      null as any,
      null as any
    )
    expect(response0?.statusCode).toBe(200)
    expect(JSON.parse(response0?.body as string)).toMatchObject({
      userId: '1',
    })
    const response1 = await userHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/users/{userId}/comments',
        {
          body: 'This is a comment',
        },
        {
          pathParameters: { userId: '1' },
        }
      ),

      null as any,
      null as any
    )
    expect(response1?.statusCode).toBe(200)
    const comment = JSON.parse(response1?.body as string)
    expect(comment).toMatchObject({
      body: 'This is a comment',
      files: [],
    })
    const response2 = await userHandler(
      getApiGatewayGetEvent(
        TEST_TENANT_ID,
        '/users/{userId}/comments/{commentId}',
        {
          pathParameters: { userId: '1', commentId: comment.commentId },
        }
      ),
      null as any,
      null as any
    )
    expect(response2?.statusCode).toBe(200)
    expect(JSON.parse(response2?.body as string)).toMatchObject({
      body: 'This is a comment',
      files: [],
    })
  })

  test('deletes a comment', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const response0 = await userCreationHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/consumer/users', consumerUser),
      null as any,
      null as any
    )
    expect(response0?.statusCode).toBe(200)
    expect(JSON.parse(response0?.body as string)).toMatchObject({
      userId: '1',
    })
    const response1 = await userHandler(
      getApiGatewayPostEvent(
        TEST_TENANT_ID,
        '/users/{userId}/comments',
        {
          body: 'This is a comment',
        },
        {
          pathParameters: { userId: '1' },
        }
      ),

      null as any,
      null as any
    )
    expect(response1?.statusCode).toBe(200)
    const comment = JSON.parse(response1?.body as string)
    expect(comment).toMatchObject({
      body: 'This is a comment',
      files: [],
    })
    const response2 = await userHandler(
      getApiGatewayDeleteEvent(
        TEST_TENANT_ID,
        '/users/{userId}/comments/{commentId}',
        {
          pathParameters: { userId: '1', commentId: comment.commentId },
        }
      ),
      null as any,
      null as any
    )
    expect(response2?.statusCode).toBe(200)
  })
})

import { MOCKED_TENANT_ID, MOCKED_USER, permissionTest } from '../test-utils'
import { ruleHandler } from '@/lambdas/console-api-rule/app'

import {
  getApiGatewayDeleteEvent,
  getApiGatewayGetEvent,
  getApiGatewayPostEvent,
} from '@/test-utils/apigateway-test-utils'

describe('testing permission for console rules endpoint', () => {
  test('rules Get: Forbidden', async () => {
    const event = getApiGatewayGetEvent(MOCKED_TENANT_ID, '/rules', {
      user: {
        ...MOCKED_USER,
        encodedPermissions: '',
      },
    })
    await permissionTest(
      ruleHandler,
      {
        functionName: 'Testing-API',
      },
      event,
      true
    )
  })
  test('rules Get: Accessible', async () => {
    const event = getApiGatewayGetEvent(MOCKED_TENANT_ID, '/rules', {
      user: {
        ...MOCKED_USER,
        encodedPermissions: 'rules:library:read',
      },
    })
    await permissionTest(
      ruleHandler,
      {
        functionName: 'Testing-API',
      },
      event,
      false
    )
  })
  test('rules Post: Forbidden', async () => {
    const event = getApiGatewayPostEvent(
      MOCKED_TENANT_ID,
      '/rules',
      {},
      {
        pathParameters: {},
        queryStringParameters: {},
        user: {
          ...MOCKED_USER,
          encodedPermissions: '',
        },
      }
    )
    await permissionTest(
      ruleHandler,
      {
        functionName: 'Testing-API',
      },
      event,
      true
    )
  })
  test('rules write: Accessible', async () => {
    const event = getApiGatewayPostEvent(
      MOCKED_TENANT_ID,
      '/rules',
      {},
      {
        user: {
          ...MOCKED_USER,
          encodedPermissions: 'rules:my-rules:write',
        },
      }
    )
    await permissionTest(
      ruleHandler,
      {
        functionName: 'Testing-API',
      },
      event,
      false
    )
  })
  test('rules delete: Forbidden', async () => {
    const event = getApiGatewayDeleteEvent(
      MOCKED_TENANT_ID,
      '/rules/{ruleId}',
      {
        pathParameters: {
          ruleId: '123',
        },
        user: {
          ...MOCKED_USER,
          encodedPermissions: '',
        },
      }
    )
    await permissionTest(
      ruleHandler,
      {
        functionName: 'Testing-API',
      },
      event,
      true
    )
  })
  test('rules delete: Accessible', async () => {
    const event = getApiGatewayDeleteEvent(
      MOCKED_TENANT_ID,
      '/rules/{ruleId}',
      {
        pathParameters: {
          ruleId: '123',
        },
        user: {
          ...MOCKED_USER,
          encodedPermissions: 'rules:my-rules:write',
        },
      }
    )
    await permissionTest(
      ruleHandler,
      {
        functionName: 'Testing-API',
      },
      event,
      false
    )
  })
  test('rules PUT: Forbidden', async () => {
    const event = getApiGatewayDeleteEvent(
      MOCKED_TENANT_ID,
      '/rules/{ruleId}',
      {
        pathParameters: {
          ruleId: '123',
        },
        user: {
          ...MOCKED_USER,
          encodedPermissions: '',
        },
      }
    )
    await permissionTest(
      ruleHandler,
      {
        functionName: 'Testing-API',
      },
      event,
      true
    )
  }),
    test('rules PUT: Accessible', async () => {
      const event = getApiGatewayDeleteEvent(
        MOCKED_TENANT_ID,
        '/rules/{ruleId}',
        {
          pathParameters: {
            ruleId: '123',
          },
          user: {
            ...MOCKED_USER,
            encodedPermissions: 'rules:my-rules:write',
          },
        }
      )
      await permissionTest(
        ruleHandler,
        {
          functionName: 'Testing-API',
        },
        event,
        false
      )
    })
})

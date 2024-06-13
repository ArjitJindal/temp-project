import { alertHandler } from '../app'
import {
  getApiGatewayGetEvent,
  getApiGatewayPatchEvent,
  getApiGatewayPostEvent,
} from '@/test-utils/apigateway-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { AlertCreationRequest } from '@/@types/openapi-public-management/AlertCreationRequest'
import { AlertUpdatable } from '@/@types/openapi-public-management/AlertUpdatable'
import { CaseCreationRequest } from '@/@types/openapi-public-management/CaseCreationRequest'
import { caseHandler } from '@/lambdas/public-management-api-case/app'
import { TransactionHitDetails } from '@/@types/openapi-public-management/TransactionHitDetails'
import {
  getTestTransaction,
  setUpTransactionsHooks,
} from '@/test-utils/transaction-test-utils'
import { withLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'

dynamoDbSetupHook()
withLocalChangeHandler()

describe('Test Create Alert', () => {
  const tenantId = getTestTenantId()
  setUpTransactionsHooks(
    tenantId,
    Array.from({ length: 5 }, (_, i) => `T-${i}`).map((id) =>
      getTestTransaction({
        transactionId: id,
        tags: [{ key: 'transactionId', value: id }],
      })
    )
  )
  test('Should throw an error on payload not present', async () => {
    const response = await alertHandler(
      getApiGatewayPostEvent(tenantId, '/alerts', {}),
      null as any,
      null as any
    )

    expect(response?.statusCode).toBe(400)
    expect(JSON.parse(response?.body as string).message).toBe(
      'Payload seems to be empty or missing. Please provide a valid payload'
    )
  })

  test('Should throw error on alert not present', async () => {
    const request: Partial<AlertCreationRequest> = {
      assignments: [],
      caseId: 'C-1234',
    }

    const response = await alertHandler(
      getApiGatewayPostEvent(tenantId, '/alerts', request),
      null as any,
      null as any
    )

    expect(response?.statusCode).toBe(400)
    expect(JSON.parse(response?.body as string).message).toBe(
      'Alert id missing in payload. Please provide an alert id'
    )
  })

  test('Should create an alert', async () => {
    const request: CaseCreationRequest = {
      caseId: 'CA-1',
      entityDetails: {
        type: 'PAYMENT',
        paymentDetails: {
          method: 'WALLET',
          walletType: 'PAYTM',
        },
      },
      priority: 'P1',
      createdTimestamp: Date.now(),
    }

    const response = await caseHandler(
      getApiGatewayPostEvent(tenantId, '/cases', request),
      null as any,
      null as any
    )

    const responseBody = JSON.parse(response?.body as string)

    expect(response?.statusCode).toBe(200)
    expect(responseBody).toEqual({
      caseId: 'CA-1',
      entityDetails: {
        type: 'PAYMENT',
        paymentDetails: {
          method: 'WALLET',
          walletType: 'PAYTM',
        },
      },
      priority: 'P1',
      createdTimestamp: request.createdTimestamp,
      alertIds: [],
      assignments: [],
      updatedAt: expect.any(Number),
      tags: [],
      caseStatus: 'OPEN',
    })

    const alertRequest: AlertCreationRequest = {
      alertId: 'AL-1',
      caseId: 'CA-1',
      createdTimestamp: Date.now(),
      priority: 'P1',
      entityDetails: {
        type: 'TRANSACTION',
        transactionIds: [],
      },
      ruleDetails: {
        action: 'ALLOW',
        description: 'Allow all transactions',
        id: 'R-1',
        instanceId: 'I-1',
        name: 'Allow all transactions',
      },
    }

    const alertResponse = await alertHandler(
      getApiGatewayPostEvent(tenantId, '/alerts', alertRequest),
      null as any,
      null as any
    )

    expect(alertResponse?.statusCode).toBe(400)
    expect(JSON.parse(alertResponse?.body as string).message).toBe(
      'Transaction ids array is empty. Please provide transaction ids'
    )
    ;(alertRequest.entityDetails as TransactionHitDetails).transactionIds = [
      'T-1',
      'T-2',
    ]

    const alertResponse2 = await alertHandler(
      getApiGatewayPostEvent(tenantId, '/alerts', alertRequest),
      null as any,
      null as any
    )

    expect(alertResponse2?.statusCode).toBe(200)
    expect(JSON.parse(alertResponse2?.body as string)).toEqual({
      alertId: 'AL-1',
      alertStatus: 'OPEN',
      caseId: 'CA-1',
      createdTimestamp: alertRequest.createdTimestamp,
      entityDetails: {
        type: 'TRANSACTION',
        transactionIds: ['T-1', 'T-2'],
      },
      priority: 'P1',
      ruleDetails: {
        action: 'ALLOW',
        description: 'Allow all transactions',
        id: 'R-1',
        instanceId: 'I-1',
        name: 'Allow all transactions',
      },
      updatedAt: expect.any(Number),
      assignments: [],
    })
  })

  test('Update Alert', async () => {
    const request: AlertUpdatable = {
      priority: 'P2',
    }

    const response = await alertHandler(
      getApiGatewayPatchEvent(tenantId, '/alerts/{alertId}', request, {
        pathParameters: { alertId: 'AL-1' },
      }),
      null as any,
      null as any
    )

    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toEqual({
      alertId: 'AL-1',
      alertStatus: 'OPEN',
      caseId: 'CA-1',
      createdTimestamp: expect.any(Number),
      entityDetails: {
        type: 'TRANSACTION',
        transactionIds: ['T-1', 'T-2'],
      },
      priority: 'P2',
      ruleDetails: {
        action: 'ALLOW',
        description: 'Allow all transactions',
        id: 'R-1',
        instanceId: 'I-1',
        name: 'Allow all transactions',
      },
      updatedAt: expect.any(Number),
      assignments: [],
    })
  })

  test('Should throw an error on alert id not present', async () => {
    const request: AlertUpdatable = {
      priority: 'P2',
    }
    const response = await alertHandler(
      getApiGatewayPatchEvent(tenantId, '/alerts/{alertId}', request, {
        pathParameters: {},
      }),
      null as any,
      null as any
    )

    expect(response?.statusCode).toBe(404)
    expect(JSON.parse(response?.body as string).message).toBe(
      'Resource not found'
    )
  })

  test('Get alert by id', async () => {
    const response = await alertHandler(
      getApiGatewayGetEvent(tenantId, '/alerts/{alertId}', {
        pathParameters: { alertId: 'AL-1' },
      }),
      null as any,
      null as any
    )

    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toEqual({
      alertId: 'AL-1',
      alertStatus: 'OPEN',
      caseId: 'CA-1',
      createdTimestamp: expect.any(Number),
      entityDetails: {
        type: 'TRANSACTION',
        transactionIds: ['T-1', 'T-2'],
      },
      priority: 'P2',
      ruleDetails: {
        action: 'ALLOW',
        description: 'Allow all transactions',
        id: 'R-1',
        instanceId: 'I-1',
        name: 'Allow all transactions',
      },
      updatedAt: expect.any(Number),
      assignments: [],
    })
  })

  test('Should throw an error on alert id not present', async () => {
    const response = await alertHandler(
      getApiGatewayGetEvent(tenantId, '/cases/{alertId}', {
        pathParameters: {},
      }),
      null as any,
      null as any
    )

    expect(response?.statusCode).toBe(404)
    expect(JSON.parse(response?.body as string).message).toBe(
      'Resource not found'
    )
  })

  test('Alert status change', async () => {
    const response = await alertHandler(
      getApiGatewayPostEvent(
        tenantId,
        '/alerts/{alertId}/statuses',
        {
          status: 'CLOSED',
          reason: ['False Positive'],
        },
        {
          pathParameters: { alertId: 'AL-1' },
        }
      ),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toEqual({
      alertStatus: 'CLOSED',
    })
  })
})

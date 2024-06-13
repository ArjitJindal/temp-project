import { caseHandler } from '../app'
import {
  getApiGatewayGetEvent,
  getApiGatewayPatchEvent,
  getApiGatewayPostEvent,
} from '@/test-utils/apigateway-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { CaseCreationRequest } from '@/@types/openapi-public-management/CaseCreationRequest'
import { CaseUpdateable } from '@/@types/openapi-public-management/CaseUpdateable'

dynamoDbSetupHook()

describe('Test Create Case', () => {
  const tenantId = getTestTenantId()
  test('Should throw an error on payload not present', async () => {
    const response = await caseHandler(
      getApiGatewayPostEvent(tenantId, '/cases', {}),
      null as any,
      null as any
    )

    expect(response?.statusCode).toBe(400)
    expect(JSON.parse(response?.body as string).message).toBe(
      'Payload seems to be empty or missing. Please provide a valid payload'
    )
  })

  test('Should throw error on caseId not present', async () => {
    const request: Partial<CaseCreationRequest> = {
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

    expect(response?.statusCode).toBe(400)
    expect(JSON.parse(response?.body as string).message).toBe(
      'Case id missing in payload. Please provide a case id'
    )
  })

  test('Should create a case', async () => {
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
      assignments: [],
      alertIds: [],
      updatedAt: expect.any(Number),
      tags: [],
      caseStatus: 'OPEN',
    })
  })

  test('Update case', async () => {
    const request: CaseUpdateable = {
      priority: 'P2',
    }

    const response = await caseHandler(
      getApiGatewayPatchEvent(tenantId, '/cases/{caseId}', request, {
        pathParameters: { caseId: 'CA-1' },
      }),
      null as any,
      null as any
    )

    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toEqual({
      caseId: 'CA-1',
      entityDetails: {
        type: 'PAYMENT',
        paymentDetails: {
          method: 'WALLET',
          walletType: 'PAYTM',
        },
      },
      priority: 'P2',
      createdTimestamp: expect.any(Number),
      alertIds: [],
      assignments: [],
      updatedAt: expect.any(Number),
      tags: [],
      caseStatus: 'OPEN',
      creationReason: null,
    })
  })

  test('Should throw an error on case id not present', async () => {
    const request: CaseUpdateable = {
      priority: 'P2',
    }
    const response = await caseHandler(
      getApiGatewayPatchEvent(tenantId, '/cases/{caseId}', request, {
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

  test('Get cases', async () => {
    const response = await caseHandler(
      getApiGatewayGetEvent(tenantId, '/cases', {}),
      null as any,
      null as any
    )

    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toEqual({
      hasNext: false,
      hasPrev: false,
      count: 1,
      items: [
        {
          caseId: 'CA-1',
          entityDetails: {
            type: 'PAYMENT',
            paymentDetails: {
              method: 'WALLET',
              walletType: 'PAYTM',
            },
          },
          priority: 'P2',
          createdTimestamp: expect.any(Number),
          assignments: [],
          alertIds: [],
          updatedAt: expect.any(Number),
          tags: [],
          caseStatus: 'OPEN',
          creationReason: null,
        },
      ],
      last: '',
      next: '',
      prev: '',
      pageSize: 20,
    })
  })

  test('Get case by id', async () => {
    const response = await caseHandler(
      getApiGatewayGetEvent(tenantId, '/cases/{caseId}', {
        pathParameters: { caseId: 'CA-1' },
      }),
      null as any,
      null as any
    )

    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toEqual({
      caseId: 'CA-1',
      entityDetails: {
        type: 'PAYMENT',
        paymentDetails: {
          method: 'WALLET',
          walletType: 'PAYTM',
        },
      },
      priority: 'P2',
      createdTimestamp: expect.any(Number),
      alertIds: [],
      assignments: [],
      updatedAt: expect.any(Number),
      tags: [],
      caseStatus: 'OPEN',
      creationReason: null,
    })
  })

  test('Should throw an error on case id not present', async () => {
    const response = await caseHandler(
      getApiGatewayGetEvent(tenantId, '/cases/{caseId}', {
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

  test('Change the status of a case', async () => {
    const response = await caseHandler(
      getApiGatewayPostEvent(
        tenantId,
        '/cases/{caseId}/statuses',
        {
          status: 'CLOSED',
          reason: ['False Positive'],
        },
        {
          pathParameters: { caseId: 'CA-1' },
        }
      ),
      null as any,
      null as any
    )
    expect(response?.statusCode).toBe(200)
    expect(JSON.parse(response?.body as string)).toEqual({
      caseStatus: 'CLOSED',
    })
  })
})

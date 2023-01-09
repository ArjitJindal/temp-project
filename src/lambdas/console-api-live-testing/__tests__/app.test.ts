import 'aws-sdk-client-mock-jest'
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { mockClient } from 'aws-sdk-client-mock'
import { liveTestingHandler } from '../app'
import { LiveTestPulseParameters } from '@/@types/openapi-internal/LiveTestPulseParameters'
import {
  getApiGatewayGetEvent,
  getApiGatewayPostEvent,
} from '@/test-utils/apigateway-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'

const TEST_PARAMETERS: LiveTestPulseParameters = {
  type: 'PULSE',
  classificationValues: [],
  parameterAttributeRiskValues: [],
  sampling: {
    usersCount: 100,
  },
}

describe('Consoel API - Live Testing', () => {
  let sqsMock: any

  beforeEach(() => {
    sqsMock = mockClient(SQSClient)
  })

  test('creates a new live testing task', async () => {
    const tenantId = getTestTenantId()
    const response = await liveTestingHandler(
      getApiGatewayPostEvent(tenantId, '/live-testing', TEST_PARAMETERS),
      null as any,
      null as any
    )
    expect(response?.statusCode).toEqual(200)
    expect(JSON.parse(response?.body as string)).toEqual({
      taskId: expect.any(String),
    })
    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 1)
    expect(
      JSON.parse(
        sqsMock.commandCalls(SendMessageCommand)[0].firstArg.input.MessageBody
      )
    ).toEqual({
      type: 'LIVE_TESTING_PULSE',
      tenantId,
      parameters: {
        taskId: expect.any(String),
        ...TEST_PARAMETERS,
      },
    })
  })

  test('gets a live testing task by ID', async () => {
    const tenantId = getTestTenantId()
    const taskId: string = JSON.parse(
      (
        await liveTestingHandler(
          getApiGatewayPostEvent(tenantId, '/live-testing', TEST_PARAMETERS),
          null as any,
          null as any
        )
      )?.body as string
    ).taskId
    const response = await liveTestingHandler(
      getApiGatewayGetEvent(tenantId, '/live-testing/{taskId}', {
        pathParameters: { taskId },
      }),
      null as any,
      null as any
    )

    expect(response?.statusCode).toEqual(200)
    expect(JSON.parse(response?.body as string)).toEqual({
      taskId,
      createdAt: expect.any(Number),
      type: 'PULSE',
      parameters: TEST_PARAMETERS,
      progress: 0,
      statistics: [],
      latestStatus: { status: 'PENDING', timestamp: expect.any(Number) },
      statuses: [{ status: 'PENDING', timestamp: expect.any(Number) }],
    })
  })

  test('gets a non-existent live testing task', async () => {
    const tenantId = getTestTenantId()
    const response = await liveTestingHandler(
      getApiGatewayGetEvent(tenantId, '/live-testing/{taskId}', {
        pathParameters: { taskId: 'unknown' },
      }),
      null as any,
      null as any
    )

    expect(response?.statusCode).toEqual(404)
  })

  test('gets live testing tasks', async () => {
    const tenantId = getTestTenantId()
    const taskId: string = JSON.parse(
      (
        await liveTestingHandler(
          getApiGatewayPostEvent(tenantId, '/live-testing', TEST_PARAMETERS),
          null as any,
          null as any
        )
      )?.body as string
    ).taskId
    const response = await liveTestingHandler(
      getApiGatewayGetEvent(tenantId, '/live-testing', {
        queryStringParameters: { page: '0', type: 'PULSE' },
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toEqual(200)
    expect(JSON.parse(response?.body as string)).toEqual({
      total: 1,
      data: [
        {
          taskId,
          createdAt: expect.any(Number),
          type: 'PULSE',
          parameters: TEST_PARAMETERS,
          progress: 0,
          statistics: [],
          latestStatus: { status: 'PENDING', timestamp: expect.any(Number) },
          statuses: [{ status: 'PENDING', timestamp: expect.any(Number) }],
        },
      ],
    })
    const unknownResponse = await liveTestingHandler(
      getApiGatewayGetEvent(tenantId, '/live-testing', {
        queryStringParameters: { page: '0', type: 'UNKNOWN' },
      }),
      null as any,
      null as any
    )
    expect(unknownResponse?.statusCode).toEqual(200)
    expect(JSON.parse(unknownResponse?.body as string)).toEqual({
      total: 0,
      data: [],
    })
  })
})

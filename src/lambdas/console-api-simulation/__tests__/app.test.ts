import 'aws-sdk-client-mock-jest'
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { mockClient } from 'aws-sdk-client-mock'
import { simulationHandler } from '../app'
import { SimulationPulseParameters } from '@/@types/openapi-internal/SimulationPulseParameters'
import {
  getApiGatewayGetEvent,
  getApiGatewayPostEvent,
} from '@/test-utils/apigateway-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'

const TEST_PARAMETERS: SimulationPulseParameters = {
  type: 'PULSE',
  classificationValues: [],
  parameterAttributeRiskValues: [],
  sampling: {
    usersCount: 100,
  },
}

describe('Consoel API - Simulation', () => {
  let sqsMock: any

  beforeEach(() => {
    sqsMock = mockClient(SQSClient)
  })

  test('creates a new simulation task', async () => {
    const tenantId = getTestTenantId()
    const response = await simulationHandler(
      getApiGatewayPostEvent(tenantId, '/simulation', TEST_PARAMETERS),
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
      type: 'SIMULATION_PULSE',
      tenantId,
      parameters: {
        taskId: expect.any(String),
        ...TEST_PARAMETERS,
      },
    })
  })

  test('gets a simulation task by ID', async () => {
    const tenantId = getTestTenantId()
    const taskId: string = JSON.parse(
      (
        await simulationHandler(
          getApiGatewayPostEvent(tenantId, '/simulation', TEST_PARAMETERS),
          null as any,
          null as any
        )
      )?.body as string
    ).taskId
    const response = await simulationHandler(
      getApiGatewayGetEvent(tenantId, '/simulation/{taskId}', {
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
      statistics: { current: [], simulated: [] },
      latestStatus: { status: 'PENDING', timestamp: expect.any(Number) },
      statuses: [{ status: 'PENDING', timestamp: expect.any(Number) }],
    })
  })

  test('gets a non-existent simulation task', async () => {
    const tenantId = getTestTenantId()
    const response = await simulationHandler(
      getApiGatewayGetEvent(tenantId, '/simulation/{taskId}', {
        pathParameters: { taskId: 'unknown' },
      }),
      null as any,
      null as any
    )

    expect(response?.statusCode).toEqual(404)
  })

  test('gets simulation tasks', async () => {
    const tenantId = getTestTenantId()
    const taskId: string = JSON.parse(
      (
        await simulationHandler(
          getApiGatewayPostEvent(tenantId, '/simulation', TEST_PARAMETERS),
          null as any,
          null as any
        )
      )?.body as string
    ).taskId
    const response = await simulationHandler(
      getApiGatewayGetEvent(tenantId, '/simulation', {
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
          statistics: { current: [], simulated: [] },
          latestStatus: { status: 'PENDING', timestamp: expect.any(Number) },
          statuses: [{ status: 'PENDING', timestamp: expect.any(Number) }],
        },
      ],
    })
    const unknownResponse = await simulationHandler(
      getApiGatewayGetEvent(tenantId, '/simulation', {
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

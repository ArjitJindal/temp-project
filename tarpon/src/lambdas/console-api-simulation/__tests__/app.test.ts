import 'aws-sdk-client-mock-jest'
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { mockClient } from 'aws-sdk-client-mock'
import { simulationHandler } from '../app'
import {
  getApiGatewayGetEvent,
  getApiGatewayPostEvent,
} from '@/test-utils/apigateway-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '@/services/risk-scoring/repositories/risk-repository'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import * as jwt from '@/@types/jwt'
import { SimulationPostRequest } from '@/@types/openapi-internal/SimulationPostRequest'

const TEST_PARAMETERS: SimulationPostRequest = {
  riskLevelsParameters: {
    parameters: [
      {
        type: 'PULSE',
        classificationValues: [],
        parameterAttributeRiskValues: [],
        sampling: {
          usersCount: 100,
        },
        name: 'Test Simulation',
      },
    ],
    type: 'PULSE',
    defaultRiskClassifications: DEFAULT_CLASSIFICATION_SETTINGS,
  },
}

withFeatureHook(['SIMULATOR'])
dynamoDbSetupHook()

describe('Consoel API - Simulation', () => {
  let sqsMock: any

  beforeEach(() => {
    sqsMock = mockClient(SQSClient)
  })

  test.skip('creates a new simulation task', async () => {
    const tenantId = getTestTenantId()
    const response = await simulationHandler(
      getApiGatewayPostEvent(tenantId, '/simulation', TEST_PARAMETERS),
      null as any,
      null as any
    )
    expect(response?.statusCode).toEqual(200)
    expect(JSON.parse(response?.body as string)).toEqual({
      taskIds: expect.any(Array),
      jobId: expect.any(String),
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
        jobId: expect.any(String),
        ...TEST_PARAMETERS.riskLevelsParameters?.parameters[0],
      },
    })
  })

  test('gets a simulation task by ID', async () => {
    const tenantId = getTestTenantId()
    const jobId: string = JSON.parse(
      (
        await simulationHandler(
          getApiGatewayPostEvent(tenantId, '/simulation', TEST_PARAMETERS),
          null as any,
          null as any
        )
      )?.body as string
    ).jobId
    const response = await simulationHandler(
      getApiGatewayGetEvent(tenantId, '/simulation/jobs/{jobId}', {
        pathParameters: { jobId },
      }),
      null as any,
      null as any
    )

    expect(response?.statusCode).toEqual(200)
    expect(JSON.parse(response?.body as string)).toMatchObject({
      createdAt: expect.any(Number),
      jobId: expect.any(String),
      type: 'PULSE',
      iterations: [
        {
          taskId: expect.any(String),
          parameters: {
            type: 'PULSE',
            classificationValues: [],
            parameterAttributeRiskValues: [],
            sampling: { usersCount: 100 },
            name: 'Test Simulation',
          },
          progress: 0,
          statistics: { current: [], simulated: [] },
          latestStatus: { status: 'PENDING', timestamp: expect.any(Number) },
          statuses: [{ status: 'PENDING', timestamp: expect.any(Number) }],
          createdAt: expect.any(Number),
          description: null,
          name: 'Test Simulation',
          type: 'PULSE',
          createdBy: 'test',
        },
      ],
      defaultRiskClassifications: DEFAULT_CLASSIFICATION_SETTINGS,
      createdBy: 'test',
    })
  })

  test('gets a non-existent simulation task', async () => {
    const tenantId = getTestTenantId()
    const response = await simulationHandler(
      getApiGatewayGetEvent(tenantId, '/simulation/jobs/{jobId}', {
        pathParameters: { jobId: 'unknown' },
      }),
      null as any,
      null as any
    )

    expect(response?.statusCode).toEqual(404)
  })

  test('gets simulation tasks', async () => {
    const tenantId = getTestTenantId()
    const spy = jest
      .spyOn(jwt, 'isCurrentUserAtLeastRole')
      .mockReturnValue(false)
    const { jobId, taskIds } = JSON.parse(
      (
        await simulationHandler(
          getApiGatewayPostEvent(tenantId, '/simulation', TEST_PARAMETERS),
          null as any,
          null as any
        )
      )?.body as string
    )
    spy.mockRestore()
    const response = await simulationHandler(
      getApiGatewayGetEvent(tenantId, '/simulation', {
        queryStringParameters: { page: '0', type: 'PULSE' },
      }),
      null as any,
      null as any
    )
    expect(response?.statusCode).toEqual(200)
    const body = JSON.parse(response?.body as string)
    expect(body.total).toBe(1)
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({
      createdAt: expect.any(Number),
      jobId,
      type: 'PULSE',
      defaultRiskClassifications: DEFAULT_CLASSIFICATION_SETTINGS,
      iterations: [
        {
          taskId: taskIds[0],
          parameters: {
            type: 'PULSE',
            classificationValues: [],
            parameterAttributeRiskValues: [],
            sampling: { usersCount: 100 },
            name: 'Test Simulation',
          },
          progress: 0,
          statistics: { current: [], simulated: [] },
          latestStatus: {
            status: 'PENDING',
            timestamp: expect.any(Number),
          },
          statuses: [{ status: 'PENDING', timestamp: expect.any(Number) }],
          createdAt: expect.any(Number),
          name: 'Test Simulation',
          description: null,
          type: 'PULSE',
          createdBy: 'test',
        },
      ],
      createdBy: 'test',
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

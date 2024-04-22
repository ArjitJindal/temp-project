import { SimulationRiskFactorsBatchJob } from '@/@types/batch-job'
import { ParameterAttributeRiskValues } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { SimulationRiskFactorsParametersRequest } from '@/@types/openapi-internal/SimulationRiskFactorsParametersRequest'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import {
  getTestTransaction,
  setUpTransactionsHooks,
} from '@/test-utils/transaction-test-utils'
import {
  getTestBusiness,
  getTestUser,
  setUpUsersHooks,
} from '@/test-utils/user-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { withLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { SimulationTaskRepository } from '@/services/simulation/repositories/simulation-task-repository'
import { SimulationResultRepository } from '@/services/simulation/repositories/simulation-result-repository'
import { jobRunnerHandler } from '@/lambdas/batch-job/app'

withFeatureHook(['SIMULATOR', 'RISK_LEVELS', 'RISK_SCORING'])
dynamoDbSetupHook()

describe('Simulation (Risk Scoring) Batch Job Runner', () => {
  withLocalChangeHandler()
  const tenantId = getTestTenantId()

  setUpUsersHooks(tenantId, [
    getTestUser({
      userId: 'test-user-1',
      krsScore: { createdAt: Date.now(), krsScore: 40, riskLevel: 'MEDIUM' },
    }),
    getTestBusiness({
      userId: 'test-user-2',
      krsScore: { createdAt: Date.now(), krsScore: 60, riskLevel: 'HIGH' },
    }),
  ])

  setUpTransactionsHooks(tenantId, [
    getTestTransaction({
      transactionId: 'test-transaction-1',
      originUserId: 'test-user-1',
      destinationUserId: 'test-user-2',
      arsScore: { createdAt: Date.now(), arsScore: 40, riskLevel: 'MEDIUM' },
      hitRules: [],
      executedRules: [],
      originAmountDetails: {
        country: 'US',
        transactionAmount: 100,
        transactionCurrency: 'USD',
      },
    }),
    getTestTransaction({
      transactionId: 'test-transaction-2',
      originUserId: 'test-user-2',
      destinationUserId: 'test-user-1',
      arsScore: { createdAt: Date.now(), arsScore: 60, riskLevel: 'HIGH' },
      hitRules: [],
      executedRules: [],
      originAmountDetails: {
        country: 'IN',
        transactionAmount: 100,
        transactionCurrency: 'USD',
      },
    }),
  ])

  it('should run the simulation risk scoring job', async () => {
    const mongoDb = await getMongoDbClient()

    const parameterAttributeRiskValues: ParameterAttributeRiskValues[] = [
      {
        parameter: 'type',
        riskEntityType: 'CONSUMER_USER',
        defaultValue: {
          type: 'RISK_LEVEL',
          value: 'VERY_HIGH',
        },
        isActive: true,
        parameterType: 'VARIABLE',
        isDerived: true,
        riskLevelAssignmentValues: [
          {
            parameterValue: {
              content: {
                kind: 'MULTIPLE',
                values: [{ kind: 'LITERAL', content: 'CONSUMER' }],
              },
            },
            riskValue: {
              type: 'RISK_LEVEL',
              value: 'LOW',
            },
          },
        ],
        weight: 0.16,
      },
      {
        parameter: 'originAmountDetails.country',
        isActive: true,
        isDerived: false,
        riskEntityType: 'TRANSACTION',
        riskLevelAssignmentValues: [
          {
            parameterValue: {
              content: {
                kind: 'MULTIPLE',
                values: [{ kind: 'LITERAL', content: 'IN' }],
              },
            },
            riskValue: {
              type: 'RISK_LEVEL',
              value: 'HIGH',
            },
          },
          {
            parameterValue: {
              content: {
                kind: 'MULTIPLE',
                values: [{ kind: 'LITERAL', content: 'US' }],
              },
            },
            riskValue: {
              type: 'RISK_LEVEL',
              value: 'VERY_LOW',
            },
          },
        ],
        parameterType: 'VARIABLE',
        weight: 1,
        defaultValue: {
          type: 'RISK_LEVEL',
          value: 'VERY_HIGH',
        },
      },
    ]

    const parameters: SimulationRiskFactorsParametersRequest = {
      parameters: [
        {
          name: 'test-simulation-1',
          type: 'RISK_FACTORS',
          parameterAttributeRiskValues,
          description: 'Test Simulation 1',
        },
      ],
      type: 'RISK_FACTORS',
      sampling: { usersCount: 'RANDOM' },
    }

    const simulationTaskRepository = new SimulationTaskRepository(
      tenantId,
      mongoDb
    )
    const simulationResultRepository = new SimulationResultRepository(
      tenantId,
      mongoDb
    )

    const { taskIds, jobId } =
      await simulationTaskRepository.createSimulationJob(parameters)

    const testJob: SimulationRiskFactorsBatchJob = {
      type: 'SIMULATION_RISK_FACTORS',
      tenantId,
      parameters: { taskId: taskIds[0], jobId, ...parameters.parameters[0] },
      sampling: parameters.sampling ?? { usersCount: 'RANDOM' },
    }

    await jobRunnerHandler(testJob)

    const results = await simulationResultRepository.getSimulationResults({
      taskId: taskIds[0],
      page: 1,
      pageSize: 10,
    })

    const data = await simulationTaskRepository.getSimulationJob(jobId)

    expect(data).toEqual({
      createdAt: expect.any(Number),
      jobId: expect.any(String),
      createdBy: 'test',
      internal: false,
      type: 'RISK_FACTORS',
      iterations: [
        {
          taskId: expect.any(String),
          parameters: {
            name: 'test-simulation-1',
            type: 'RISK_FACTORS',
            parameterAttributeRiskValues,
            description: 'Test Simulation 1',
          },
          progress: 1,
          statistics: {
            current: [
              { count: 0, riskLevel: 'LOW', riskType: 'KRS' },
              { count: 1, riskLevel: 'MEDIUM', riskType: 'KRS' },
              { count: 1, riskLevel: 'HIGH', riskType: 'KRS' },
              { count: 0, riskLevel: 'VERY_HIGH', riskType: 'KRS' },
              { count: 0, riskLevel: 'VERY_LOW', riskType: 'KRS' },
              { count: 0, riskLevel: 'LOW', riskType: 'ARS' },
              { count: 1, riskLevel: 'MEDIUM', riskType: 'ARS' },
              { count: 1, riskLevel: 'HIGH', riskType: 'ARS' },
              { count: 0, riskLevel: 'VERY_HIGH', riskType: 'ARS' },
              { count: 0, riskLevel: 'VERY_LOW', riskType: 'ARS' },
            ],
            simulated: [
              { count: 1, riskLevel: 'LOW', riskType: 'KRS' },
              { count: 0, riskLevel: 'MEDIUM', riskType: 'KRS' },
              { count: 0, riskLevel: 'HIGH', riskType: 'KRS' },
              { count: 1, riskLevel: 'VERY_HIGH', riskType: 'KRS' },
              { count: 0, riskLevel: 'VERY_LOW', riskType: 'KRS' },
              { count: 0, riskLevel: 'LOW', riskType: 'ARS' },
              { count: 0, riskLevel: 'MEDIUM', riskType: 'ARS' },
              { count: 1, riskLevel: 'HIGH', riskType: 'ARS' },
              { count: 0, riskLevel: 'VERY_HIGH', riskType: 'ARS' },
              { count: 1, riskLevel: 'VERY_LOW', riskType: 'ARS' },
            ],
          },
          latestStatus: { status: 'SUCCESS', timestamp: expect.any(Number) },
          statuses: [
            { status: 'PENDING', timestamp: expect.any(Number) },
            { status: 'IN_PROGRESS', timestamp: expect.any(Number) },
            { status: 'SUCCESS', timestamp: expect.any(Number) },
          ],
          name: 'test-simulation-1',
          description: 'Test Simulation 1',
          type: 'RISK_FACTORS',
          createdAt: expect.any(Number),
          createdBy: 'test',
        },
      ],
    })

    expect(results.items).toHaveLength(2)
    expect(results.items).toEqual([
      {
        taskId: expect.any(String),
        type: 'RISK_FACTORS',
        userId: 'test-user-2',
        userName: 'Test Business',
        userType: 'BUSINESS',
        current: { krs: { riskScore: 60, riskLevel: 'HIGH' } },
        simulated: { krs: { riskScore: 90, riskLevel: 'VERY_HIGH' } },
      },
      {
        taskId: expect.any(String),
        type: 'RISK_FACTORS',
        userId: 'test-user-1',
        userName: 'Baran Realblood Ozkan',
        userType: 'CONSUMER',
        current: { krs: { riskScore: 40, riskLevel: 'MEDIUM' } },
        simulated: { krs: { riskScore: 30, riskLevel: 'LOW' } },
      },
    ])
  })
})

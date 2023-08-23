import { jobRunnerHandler } from '../app'
import { SimulationPulseBatchJob } from '@/@types/batch-job'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { SimulationTaskRepository } from '@/lambdas/console-api-simulation/repositories/simulation-task-repository'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { createConsumerUsers, getTestUser } from '@/test-utils/user-test-utils'
import {
  DEFAULT_CLASSIFICATION_SETTINGS,
  RiskRepository,
} from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { SimulationResultRepository } from '@/lambdas/console-api-simulation/repositories/simulation-result-repository'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { SimulationPulseParametersRequest } from '@/@types/openapi-internal/SimulationPulseParametersRequest'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { DEFAULT_RISK_LEVEL } from '@/services/risk-scoring/utils'

dynamoDbSetupHook()

withFeatureHook(['SIMULATOR'])

describe('Simulation (Pulse) batch job runner', () => {
  test('new risk level classifications', async () => {
    const tenantId = getTestTenantId()
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    await createConsumerUsers(tenantId, [
      getTestUser({
        userId: 'test-user-id-1',
        drsScore: {
          createdAt: Date.now(),
          drsScore: 30,
          userId: 'test-user-id-1',
          isUpdatable: true,
        },
      }),
      getTestUser({
        userId: 'test-user-id-2',
        drsScore: {
          createdAt: Date.now(),
          drsScore: 80,
          userId: 'test-user-id-2',
          isUpdatable: true,
        },
      }),
    ])
    const riskRepository = new RiskRepository(tenantId, { dynamoDb })
    await riskRepository.createOrUpdateRiskClassificationConfig([
      {
        riskLevel: 'LOW',
        lowerBoundRiskScore: 0,
        upperBoundRiskScore: 50,
      },
      {
        riskLevel: 'MEDIUM',
        lowerBoundRiskScore: 50,
        upperBoundRiskScore: 100,
      },
    ])
    const parameters: SimulationPulseParametersRequest = {
      parameters: [
        {
          type: 'PULSE',
          classificationValues: [
            {
              riskLevel: 'LOW',
              lowerBoundRiskScore: 0,
              upperBoundRiskScore: 10,
            },
            {
              riskLevel: 'MEDIUM',
              lowerBoundRiskScore: 10,
              upperBoundRiskScore: 100,
            },
          ],
          parameterAttributeRiskValues: [],
          sampling: {
            usersCount: 100,
          },
          name: 'test-simulation',
        },
      ],
      type: 'PULSE',
      defaultRiskClassifications: DEFAULT_CLASSIFICATION_SETTINGS,
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

    const testJob: SimulationPulseBatchJob = {
      type: 'SIMULATION_PULSE',
      tenantId: tenantId,
      parameters: {
        taskId: taskIds[0],
        jobId,
        ...parameters.parameters[0],
      },
    }

    await jobRunnerHandler(testJob)
    expect(
      await simulationTaskRepository.getSimulationJob(jobId)
    ).toMatchObject({
      iterations: [
        {
          progress: 1,
          statistics: {
            current: [
              { count: 1, riskLevel: 'LOW', riskType: 'DRS' },
              { count: 1, riskLevel: 'MEDIUM', riskType: 'DRS' },
            ],
            simulated: [{ count: 2, riskLevel: 'MEDIUM', riskType: 'DRS' }],
          },
          latestStatus: { status: 'SUCCESS', timestamp: expect.any(Number) },
          statuses: [
            { status: 'PENDING', timestamp: expect.any(Number) },
            { status: 'IN_PROGRESS', timestamp: expect.any(Number) },
            { status: 'SUCCESS', timestamp: expect.any(Number) },
          ],
          name: 'test-simulation',
          createdBy: 'test',
        },
      ],
      defaultRiskClassifications: DEFAULT_CLASSIFICATION_SETTINGS,
      createdBy: 'test',
    })
    expect(
      await simulationResultRepository.getSimulationResults({
        taskId: taskIds[0],
      })
    ).toEqual({
      items: [
        {
          current: {
            drs: {
              riskLevel: 'MEDIUM',
              riskScore: 80,
            },
            krs: null,
          },
          simulated: {
            drs: {
              riskLevel: 'MEDIUM',
              riskScore: 80,
            },
            krs: null,
          },
          taskId: taskIds[0],
          type: 'PULSE',
          userId: 'test-user-id-2',
          userType: 'CONSUMER',
          userName: 'Baran Realblood Ozkan',
        },
        {
          current: {
            drs: {
              riskLevel: 'LOW',
              riskScore: 30,
            },
            krs: null,
          },
          simulated: {
            drs: {
              riskLevel: 'MEDIUM',
              riskScore: 30,
            },
            krs: null,
          },
          taskId: taskIds[0],
          type: 'PULSE',
          userId: 'test-user-id-1',
          userType: 'CONSUMER',
          userName: 'Baran Realblood Ozkan',
        },
      ],
      total: 2,
    })
  })

  test('new risk factors', async () => {
    const tenantId = getTestTenantId()
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    await createConsumerUsers(tenantId, [
      getTestUser({
        userId: 'test-user-id-1',
        userDetails: {
          name: { firstName: 'user 1' },
          countryOfResidence: 'IN',
        },
        krsScore: {
          createdAt: Date.now(),
          userId: 'test-user-id-1',
          krsScore: 90,
        },
        drsScore: {
          createdAt: Date.now(),
          drsScore: 90,
          userId: 'test-user-id-1',
          isUpdatable: true,
        },
      }),
      getTestUser({
        userId: 'test-user-id-2',
        userDetails: {
          name: { firstName: 'user 2' },
          countryOfResidence: 'DE',
        },
        krsScore: {
          createdAt: Date.now(),
          userId: 'test-user-id-2',
          krsScore: 20,
        },
        drsScore: {
          createdAt: Date.now(),
          drsScore: 20,
          userId: 'test-user-id-2',
          isUpdatable: true,
        },
      }),
    ])
    const transactionRepository = new MongoDbTransactionRepository(
      tenantId,
      mongoDb
    )
    await transactionRepository.addTransactionToMongo({
      ...getTestTransaction({
        originUserId: 'test-user-id-1',
        destinationUserId: 'test-user-id-3',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
          country: 'IN',
        },
        arsScore: {
          createdAt: Date.now(),
          arsScore: 90,
        },
      }),
      status: 'ALLOW',
      hitRules: [],
      executedRules: [],
    })
    await transactionRepository.addTransactionToMongo({
      ...getTestTransaction({
        originUserId: 'test-user-id-3',
        destinationUserId: 'test-user-id-2',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
          country: 'DE',
        },
        arsScore: {
          createdAt: Date.now(),
          arsScore: 20,
        },
      }),
      status: 'ALLOW',
      hitRules: [],
      executedRules: [],
    })
    const riskRepository = new RiskRepository(tenantId, { dynamoDb })
    await riskRepository.createOrUpdateRiskClassificationConfig([
      {
        riskLevel: 'LOW',
        lowerBoundRiskScore: 0,
        upperBoundRiskScore: 50,
      },
      {
        riskLevel: 'MEDIUM',
        lowerBoundRiskScore: 50,
        upperBoundRiskScore: 80,
      },
      {
        riskLevel: 'HIGH',
        lowerBoundRiskScore: 80,
        upperBoundRiskScore: 100,
      },
    ])
    const parameters: SimulationPulseParametersRequest = {
      type: 'PULSE',
      parameters: [
        {
          type: 'PULSE',
          parameterAttributeRiskValues: [
            {
              parameter: 'userDetails.countryOfResidence',
              isActive: true,
              isDerived: false,
              riskEntityType: 'CONSUMER_USER',
              riskLevelAssignmentValues: [
                {
                  parameterValue: {
                    content: {
                      kind: 'MULTIPLE',
                      values: [
                        {
                          kind: 'LITERAL',
                          content: 'IN',
                        },
                      ],
                    },
                  },
                  riskLevel: 'LOW',
                },
                {
                  parameterValue: {
                    content: {
                      kind: 'MULTIPLE',
                      values: [
                        {
                          kind: 'LITERAL',
                          content: 'DE',
                        },
                      ],
                    },
                  },
                  riskLevel: 'MEDIUM',
                },
              ],
              parameterType: 'VARIABLE',
              defaultRiskLevel: DEFAULT_RISK_LEVEL,
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
                      values: [
                        {
                          kind: 'LITERAL',
                          content: 'IN',
                        },
                      ],
                    },
                  },
                  riskLevel: 'LOW',
                },
                {
                  parameterValue: {
                    content: {
                      kind: 'MULTIPLE',
                      values: [
                        {
                          kind: 'LITERAL',
                          content: 'DE',
                        },
                      ],
                    },
                  },
                  riskLevel: 'MEDIUM',
                },
              ],
              parameterType: 'VARIABLE',
              defaultRiskLevel: DEFAULT_RISK_LEVEL,
            },
          ],
          sampling: {
            usersCount: 100,
          },
          name: 'test',
        },
      ],
      defaultRiskClassifications: DEFAULT_CLASSIFICATION_SETTINGS,
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

    const testJob: SimulationPulseBatchJob = {
      type: 'SIMULATION_PULSE',
      tenantId: tenantId,
      parameters: {
        taskId: taskIds[0],
        jobId,
        ...parameters.parameters[0],
      },
    }

    await jobRunnerHandler(testJob)

    expect(
      await simulationTaskRepository.getSimulationJob(jobId)
    ).toMatchObject({
      iterations: [
        {
          progress: 1,
          statistics: {
            current: [
              { count: 1, riskLevel: 'HIGH', riskType: 'KRS' },
              { count: 1, riskLevel: 'LOW', riskType: 'KRS' },
              { count: 1, riskLevel: 'HIGH', riskType: 'DRS' },
              { count: 1, riskLevel: 'LOW', riskType: 'DRS' },
              { count: 1, riskLevel: 'HIGH', riskType: 'ARS' },
              { count: 1, riskLevel: 'LOW', riskType: 'ARS' },
            ],
            simulated: [
              { count: 1, riskLevel: 'LOW', riskType: 'KRS' },
              { count: 1, riskLevel: 'MEDIUM', riskType: 'KRS' },
              { count: 1, riskLevel: 'LOW', riskType: 'DRS' },
              { count: 1, riskLevel: 'MEDIUM', riskType: 'DRS' },
              { count: 1, riskLevel: 'LOW', riskType: 'ARS' },
              { count: 1, riskLevel: 'MEDIUM', riskType: 'ARS' },
            ],
          },
          latestStatus: { status: 'SUCCESS', timestamp: expect.any(Number) },
          statuses: [
            { status: 'PENDING', timestamp: expect.any(Number) },
            { status: 'IN_PROGRESS', timestamp: expect.any(Number) },
            { status: 'SUCCESS', timestamp: expect.any(Number) },
          ],
          name: 'test',
          createdBy: 'test',
        },
      ],
      defaultRiskClassifications: DEFAULT_CLASSIFICATION_SETTINGS,
      createdBy: 'test',
    })
    expect(
      await simulationResultRepository.getSimulationResults({
        taskId: taskIds[0],
      })
    ).toEqual({
      items: [
        {
          current: {
            drs: {
              riskLevel: 'LOW',
              riskScore: 20,
            },
            krs: {
              riskLevel: 'LOW',
              riskScore: 20,
            },
          },
          simulated: {
            drs: {
              riskLevel: 'MEDIUM',
              riskScore: 65,
            },
            krs: {
              riskLevel: 'MEDIUM',
              riskScore: 65,
            },
          },
          taskId: taskIds[0],
          type: 'PULSE',
          userId: 'test-user-id-2',
          userType: 'CONSUMER',
          userName: 'user 2',
        },
        {
          current: {
            drs: {
              riskLevel: 'HIGH',
              riskScore: 90,
            },
            krs: {
              riskLevel: 'HIGH',
              riskScore: 90,
            },
          },
          simulated: {
            drs: {
              riskLevel: 'LOW',
              riskScore: 25,
            },
            krs: {
              riskLevel: 'LOW',
              riskScore: 25,
            },
          },
          taskId: taskIds[0],
          type: 'PULSE',
          userId: 'test-user-id-1',
          userType: 'CONSUMER',
          userName: 'user 1',
        },
      ],
      total: 2,
    })
  })
})

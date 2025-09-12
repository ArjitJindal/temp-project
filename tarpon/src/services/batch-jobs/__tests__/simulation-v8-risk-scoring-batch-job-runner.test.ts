import { BatchJobWithId } from '@/@types/batch-job'
import { SimulationV8RiskFactorsParametersRequest } from '@/@types/openapi-internal/SimulationV8RiskFactorsParametersRequest'
import { SimulationV8RiskFactorsResult } from '@/@types/openapi-internal/SimulationV8RiskFactorsResult'
import { V8RiskSimulationJob } from '@/@types/openapi-internal/V8RiskSimulationJob'
import { jobRunnerHandler } from '@/lambdas/batch-job/app'
import { SimulationResultRepository } from '@/services/simulation/repositories/simulation-result-repository'
import { SimulationTaskRepository } from '@/services/simulation/repositories/simulation-task-repository'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { getTestRiskFactor } from '@/test-utils/pulse-test-utils'
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
import { withLocalChangeHandler } from '@/utils/local-change-handler'
import { getMongoDbClient } from '@/utils/mongodb-utils'

withFeatureHook(['SIMULATOR', 'RISK_LEVELS', 'RISK_SCORING'])
dynamoDbSetupHook()

describe('Simulation (Risk Scoring) Batch Job Runner', () => {
  withLocalChangeHandler()
  const tenantId = getTestTenantId()
  describe('Simulation with different algorithms', () => {
    setUpUsersHooks(
      tenantId,
      [
        getTestUser({
          userId: 'test-user-1',
          kycStatusDetails: {
            status: 'CANCELLED',
          },
          krsScore: {
            createdAt: Date.now(),
            krsScore: 40,
            riskLevel: 'MEDIUM',
          },
          drsScore: {
            createdAt: Date.now(),
            drsScore: 60,
            derivedRiskLevel: 'HIGH',
            isUpdatable: true,
          },
        }),
        getTestBusiness({
          userId: 'test-user-2',
          krsScore: { createdAt: Date.now(), krsScore: 60, riskLevel: 'HIGH' },
          kycStatusDetails: {
            status: 'EXPIRED',
          },
          drsScore: {
            createdAt: Date.now(),
            drsScore: 60,
            derivedRiskLevel: 'HIGH',
            isUpdatable: true,
          },
        }),
      ],
      false
    )
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
          transactionAmount: 200,
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
    const testRiskFactors = [
      getTestRiskFactor({
        id: 'RF-1',
        riskLevelLogic: [
          {
            logic: {
              and: [
                {
                  '==': [
                    {
                      var: 'TRANSACTION:originAmountDetails-transactionAmount',
                    },
                    100,
                  ],
                },
              ],
            },
            weight: 1,
            riskLevel: 'LOW',
            riskScore: 30,
          },
          {
            logic: {
              and: [
                {
                  '>': [
                    {
                      var: 'TRANSACTION:originAmountDetails-transactionAmount',
                    },
                    100,
                  ],
                },
              ],
            },
            weight: 1,
            riskLevel: 'MEDIUM',
            riskScore: 50,
          },
        ],
        type: 'TRANSACTION',
      }),
      getTestRiskFactor({
        id: 'RF-2',
        type: 'CONSUMER_USER',
        riskLevelLogic: [
          {
            logic: {
              and: [
                {
                  '==': [
                    {
                      var: 'CONSUMER_USER:kycStatusDetails-status__SENDER',
                    },
                    'CANCELLED',
                  ],
                },
              ],
            },
            weight: 1,
            riskLevel: 'VERY_HIGH',
            riskScore: 100,
          },
        ],
      }),
      getTestRiskFactor({
        id: 'RF-3',
        type: 'BUSINESS',
        riskLevelLogic: [
          {
            logic: {
              and: [
                {
                  '==': [
                    {
                      var: 'BUSINESS_USER:kycStatusDetails-status__SENDER',
                    },
                    'EXPIRED',
                  ],
                },
              ],
            },
            weight: 1,
            riskLevel: 'HIGH',
            riskScore: 70,
          },
        ],
      }),
    ]

    test('should run the simulation v8 risk scoring job (Simple avg algorithm)', async () => {
      const mongoDb = await getMongoDbClient()
      const simulationTaskRepository = new SimulationTaskRepository(
        tenantId,
        mongoDb
      )
      const simulationResultRepository = new SimulationResultRepository(
        tenantId,
        mongoDb
      )
      const parameters: SimulationV8RiskFactorsParametersRequest = {
        parameters: [
          {
            name: 'test-simulation-1',
            parameters: testRiskFactors,
            description: 'Test Simulation 1',
            type: 'RISK_FACTORS_V8',
            sampling: {
              sample: { type: 'ALL' },
            },
          },
        ],
        type: 'RISK_FACTORS_V8',
      }
      const { taskIds, jobId } =
        await simulationTaskRepository.createSimulationJob(parameters)
      const testJob: BatchJobWithId = {
        type: 'SIMULATION_RISK_FACTORS_V8',
        tenantId,
        parameters: {
          taskId: taskIds[0],
          jobId,
          sampling: parameters.parameters[0].sampling ?? {
            sample: { type: 'ALL' },
          },
        },
        jobId,
      }
      await jobRunnerHandler(testJob)

      const data: V8RiskSimulationJob | null =
        await simulationTaskRepository.getSimulationJob<V8RiskSimulationJob>(
          jobId
        )
      const results = await simulationResultRepository.getSimulationResults({
        taskId: taskIds[0],
        page: 1,
        pageSize: 10,
      })
      expect(data).toEqual({
        createdAt: expect.any(Number),
        jobId: expect.any(String),
        createdBy: 'test',
        internal: false,
        type: 'RISK_FACTORS_V8',
        iterations: [
          {
            taskId: expect.any(String),
            parameters: {
              name: 'test-simulation-1',
              type: 'RISK_FACTORS_V8',
              parameters: testRiskFactors,
              description: 'Test Simulation 1',
              sampling: {
                sample: { type: 'ALL' },
              },
            },
            progress: 1,
            statistics: {
              current: [
                {
                  count: 0,
                  riskLevel: 'LOW',
                  riskType: 'KRS',
                },
                {
                  count: 1,
                  riskLevel: 'MEDIUM',
                  riskType: 'KRS',
                },
                {
                  count: 1,
                  riskLevel: 'HIGH',
                  riskType: 'KRS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_HIGH',
                  riskType: 'KRS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_LOW',
                  riskType: 'KRS',
                },
                {
                  count: 0,
                  riskLevel: 'LOW',
                  riskType: 'DRS',
                },
                {
                  count: 0,
                  riskLevel: 'MEDIUM',
                  riskType: 'DRS',
                },
                {
                  count: 2,
                  riskLevel: 'HIGH',
                  riskType: 'DRS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_HIGH',
                  riskType: 'DRS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_LOW',
                  riskType: 'DRS',
                },
                {
                  count: 0,
                  riskLevel: 'LOW',
                  riskType: 'ARS',
                },
                {
                  count: 1,
                  riskLevel: 'MEDIUM',
                  riskType: 'ARS',
                },
                {
                  count: 1,
                  riskLevel: 'HIGH',
                  riskType: 'ARS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_HIGH',
                  riskType: 'ARS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_LOW',
                  riskType: 'ARS',
                },
              ],
              simulated: [
                {
                  count: 0,
                  riskLevel: 'LOW',
                  riskType: 'KRS',
                },
                {
                  count: 0,
                  riskLevel: 'MEDIUM',
                  riskType: 'KRS',
                },
                {
                  count: 1,
                  riskLevel: 'HIGH',
                  riskType: 'KRS',
                },
                {
                  count: 1,
                  riskLevel: 'VERY_HIGH',
                  riskType: 'KRS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_LOW',
                  riskType: 'KRS',
                },
                {
                  count: 0,
                  riskLevel: 'LOW',
                  riskType: 'DRS',
                },
                {
                  count: 1,
                  riskLevel: 'MEDIUM',
                  riskType: 'DRS',
                },
                {
                  count: 1,
                  riskLevel: 'HIGH',
                  riskType: 'DRS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_HIGH',
                  riskType: 'DRS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_LOW',
                  riskType: 'DRS',
                },
                {
                  count: 1,
                  riskLevel: 'LOW',
                  riskType: 'ARS',
                },
                {
                  count: 1,
                  riskLevel: 'MEDIUM',
                  riskType: 'ARS',
                },
                {
                  count: 0,
                  riskLevel: 'HIGH',
                  riskType: 'ARS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_HIGH',
                  riskType: 'ARS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_LOW',
                  riskType: 'ARS',
                },
              ],
            },
            latestStatus: {
              status: 'SUCCESS',
              timestamp: expect.any(Number),
            },
            statuses: [
              {
                status: 'PENDING',
                timestamp: expect.any(Number),
              },
              {
                status: 'IN_PROGRESS',
                timestamp: expect.any(Number),
              },
              {
                status: 'IN_PROGRESS',
                timestamp: expect.any(Number),
              },
              {
                status: 'IN_PROGRESS',
                timestamp: expect.any(Number),
              },
              {
                status: 'SUCCESS',
                timestamp: expect.any(Number),
              },
            ],
            name: 'test-simulation-1',
            description: 'Test Simulation 1',
            type: 'RISK_FACTORS_V8',
            createdAt: expect.any(Number),
            createdBy: 'test',
            totalEntities: 2,
          },
        ],
      })
      expect(results.items).toHaveLength(2)
      expect(results.items).toEqual([
        {
          userId: 'test-user-2',
          type: 'RISK_FACTORS_V8',
          userName: 'Test Business',
          userType: 'BUSINESS',
          taskId: expect.any(String),
          current: {
            krs: {
              riskScore: 60,
              riskLevel: 'HIGH',
            },
            drs: {
              riskScore: 60,
              riskLevel: 'HIGH',
            },
          },
          simulated: {
            krs: {
              riskScore: 70,
              riskLevel: 'HIGH',
            },
            drs: {
              riskScore: 55,
              riskLevel: 'MEDIUM',
            },
          },
        },
        {
          userId: 'test-user-1',
          type: 'RISK_FACTORS_V8',
          userName: 'Baran Realblood Ozkan',
          userType: 'CONSUMER',
          taskId: expect.any(String),
          current: {
            krs: {
              riskScore: 40,
              riskLevel: 'MEDIUM',
            },
            drs: {
              riskScore: 60,
              riskLevel: 'HIGH',
            },
          },
          simulated: {
            krs: {
              riskScore: 100,
              riskLevel: 'VERY_HIGH',
            },
            drs: {
              riskScore: 70,
              riskLevel: 'HIGH',
            },
          },
        },
      ])
    })
    test('should run the simulation v8 risk scoring job (Legacy moving avg algorithm)', async () => {
      const mongoDb = await getMongoDbClient()
      const simulationTaskRepository = new SimulationTaskRepository(
        tenantId,
        mongoDb
      )
      const simulationResultRepository = new SimulationResultRepository(
        tenantId,
        mongoDb
      )
      const parameters: SimulationV8RiskFactorsParametersRequest = {
        parameters: [
          {
            name: 'test-simulation-1',
            parameters: testRiskFactors,
            description: 'Test Simulation 1',
            type: 'RISK_FACTORS_V8',
            riskScoringAlgorithm: {
              type: 'FORMULA_LEGACY_MOVING_AVG',
            },
            sampling: { sample: { type: 'ALL' } },
          },
        ],
        type: 'RISK_FACTORS_V8',
      }
      const { taskIds, jobId } =
        await simulationTaskRepository.createSimulationJob(parameters)
      const testJob: BatchJobWithId = {
        type: 'SIMULATION_RISK_FACTORS_V8',
        tenantId,
        parameters: {
          taskId: taskIds[0],
          jobId,
          sampling: parameters.parameters[0].sampling ?? {
            sample: { usersCount: 'RANDOM' },
          },
        },
        jobId,
      }
      await jobRunnerHandler(testJob)

      const data: V8RiskSimulationJob | null =
        await simulationTaskRepository.getSimulationJob<V8RiskSimulationJob>(
          jobId
        )
      const results = await simulationResultRepository.getSimulationResults({
        taskId: taskIds[0],
        page: 1,
        pageSize: 10,
      })
      expect(data).toEqual({
        createdAt: expect.any(Number),
        jobId: expect.any(String),
        createdBy: 'test',
        internal: false,
        type: 'RISK_FACTORS_V8',
        iterations: [
          {
            taskId: expect.any(String),
            parameters: {
              name: 'test-simulation-1',
              type: 'RISK_FACTORS_V8',
              parameters: testRiskFactors,
              description: 'Test Simulation 1',
              riskScoringAlgorithm: {
                type: 'FORMULA_LEGACY_MOVING_AVG',
              },
              sampling: { sample: { type: 'ALL' } },
            },
            progress: 1,
            statistics: {
              current: [
                {
                  count: 0,
                  riskLevel: 'LOW',
                  riskType: 'KRS',
                },
                {
                  count: 1,
                  riskLevel: 'MEDIUM',
                  riskType: 'KRS',
                },
                {
                  count: 1,
                  riskLevel: 'HIGH',
                  riskType: 'KRS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_HIGH',
                  riskType: 'KRS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_LOW',
                  riskType: 'KRS',
                },
                {
                  count: 0,
                  riskLevel: 'LOW',
                  riskType: 'DRS',
                },
                {
                  count: 0,
                  riskLevel: 'MEDIUM',
                  riskType: 'DRS',
                },
                {
                  count: 2,
                  riskLevel: 'HIGH',
                  riskType: 'DRS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_HIGH',
                  riskType: 'DRS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_LOW',
                  riskType: 'DRS',
                },
                {
                  count: 0,
                  riskLevel: 'LOW',
                  riskType: 'ARS',
                },
                {
                  count: 1,
                  riskLevel: 'MEDIUM',
                  riskType: 'ARS',
                },
                {
                  count: 1,
                  riskLevel: 'HIGH',
                  riskType: 'ARS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_HIGH',
                  riskType: 'ARS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_LOW',
                  riskType: 'ARS',
                },
              ],
              simulated: [
                {
                  count: 0,
                  riskLevel: 'LOW',
                  riskType: 'KRS',
                },
                {
                  count: 0,
                  riskLevel: 'MEDIUM',
                  riskType: 'KRS',
                },
                {
                  count: 1,
                  riskLevel: 'HIGH',
                  riskType: 'KRS',
                },
                {
                  count: 1,
                  riskLevel: 'VERY_HIGH',
                  riskType: 'KRS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_LOW',
                  riskType: 'KRS',
                },
                {
                  count: 0,
                  riskLevel: 'LOW',
                  riskType: 'DRS',
                },
                {
                  count: 2,
                  riskLevel: 'MEDIUM',
                  riskType: 'DRS',
                },
                {
                  count: 0,
                  riskLevel: 'HIGH',
                  riskType: 'DRS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_HIGH',
                  riskType: 'DRS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_LOW',
                  riskType: 'DRS',
                },
                {
                  count: 1,
                  riskLevel: 'LOW',
                  riskType: 'ARS',
                },
                {
                  count: 1,
                  riskLevel: 'MEDIUM',
                  riskType: 'ARS',
                },
                {
                  count: 0,
                  riskLevel: 'HIGH',
                  riskType: 'ARS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_HIGH',
                  riskType: 'ARS',
                },
                {
                  count: 0,
                  riskLevel: 'VERY_LOW',
                  riskType: 'ARS',
                },
              ],
            },
            latestStatus: {
              status: 'SUCCESS',
              timestamp: expect.any(Number),
            },
            statuses: [
              {
                status: 'PENDING',
                timestamp: expect.any(Number),
              },
              {
                status: 'IN_PROGRESS',
                timestamp: expect.any(Number),
              },
              {
                status: 'IN_PROGRESS',
                timestamp: expect.any(Number),
              },
              {
                status: 'IN_PROGRESS',
                timestamp: expect.any(Number),
              },
              {
                status: 'SUCCESS',
                timestamp: expect.any(Number),
              },
            ],
            name: 'test-simulation-1',
            description: 'Test Simulation 1',
            type: 'RISK_FACTORS_V8',
            createdAt: expect.any(Number),
            createdBy: 'test',
            totalEntities: 2,
          },
        ],
      })
      expect(results.items).toHaveLength(2)
      expect(results.items).toEqual([
        {
          userId: 'test-user-2',
          type: 'RISK_FACTORS_V8',
          userName: 'Test Business',
          userType: 'BUSINESS',
          taskId: expect.any(String),
          current: {
            krs: {
              riskScore: 60,
              riskLevel: 'HIGH',
            },
            drs: {
              riskScore: 60,
              riskLevel: 'HIGH',
            },
          },
          simulated: {
            krs: {
              riskScore: 70,
              riskLevel: 'HIGH',
            },
            drs: {
              riskScore: 45,
              riskLevel: 'MEDIUM',
            },
          },
        },
        {
          userId: 'test-user-1',
          type: 'RISK_FACTORS_V8',
          userName: 'Baran Realblood Ozkan',
          userType: 'CONSUMER',
          taskId: expect.any(String),
          current: {
            krs: {
              riskScore: 40,
              riskLevel: 'MEDIUM',
            },
            drs: {
              riskScore: 60,
              riskLevel: 'HIGH',
            },
          },
          simulated: {
            krs: {
              riskScore: 100,
              riskLevel: 'VERY_HIGH',
            },
            drs: {
              riskScore: 52.5,
              riskLevel: 'MEDIUM',
            },
          },
        },
      ])
    })
  })
  describe('Simulation with random sampling with filters', () => {
    setUpUsersHooks(
      tenantId,
      [
        getTestUser({
          userId: 'test-user-1',
          kycStatusDetails: {
            status: 'CANCELLED',
          },
          krsScore: {
            createdAt: Date.now(),
            krsScore: 40,
            riskLevel: 'MEDIUM',
          },
          drsScore: {
            createdAt: Date.now(),
            drsScore: 60,
            derivedRiskLevel: 'HIGH',
            isUpdatable: true,
          },
        }),
        getTestBusiness({
          userId: 'test-user-2',
          krsScore: { createdAt: Date.now(), krsScore: 60, riskLevel: 'HIGH' },
          kycStatusDetails: {
            status: 'EXPIRED',
          },
          drsScore: {
            createdAt: Date.now(),
            drsScore: 80,
            derivedRiskLevel: 'VERY_HIGH',
            isUpdatable: true,
          },
        }),
        getTestUser({
          userId: 'test-user-3',
          krsScore: { createdAt: Date.now(), krsScore: 30, riskLevel: 'LOW' },
          kycStatusDetails: {
            status: 'CANCELLED',
          },
          drsScore: {
            createdAt: Date.now(),
            drsScore: 10,
            derivedRiskLevel: 'VERY_LOW',
            isUpdatable: true,
          },
        }),
        getTestBusiness({
          userId: 'test-user-4',
          krsScore: { createdAt: Date.now(), krsScore: 60, riskLevel: 'HIGH' },
          kycStatusDetails: {
            status: 'EXPIRED',
          },
          drsScore: {
            createdAt: Date.now(),
            drsScore: 50,
            derivedRiskLevel: 'MEDIUM',
            isUpdatable: true,
          },
        }),
      ],
      false
    )
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
          transactionAmount: 200,
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
    const testRiskFactors = [
      getTestRiskFactor({
        id: 'RF-1',
        riskLevelLogic: [
          {
            logic: {
              and: [
                {
                  '==': [
                    {
                      var: 'TRANSACTION:originAmountDetails-transactionAmount',
                    },
                    100,
                  ],
                },
              ],
            },
            weight: 1,
            riskLevel: 'LOW',
            riskScore: 30,
          },
          {
            logic: {
              and: [
                {
                  '>': [
                    {
                      var: 'TRANSACTION:originAmountDetails-transactionAmount',
                    },
                    100,
                  ],
                },
              ],
            },
            weight: 1,
            riskLevel: 'MEDIUM',
            riskScore: 50,
          },
        ],
        type: 'TRANSACTION',
      }),
      getTestRiskFactor({
        id: 'RF-2',
        type: 'CONSUMER_USER',
        riskLevelLogic: [
          {
            logic: {
              and: [
                {
                  '==': [
                    {
                      var: 'CONSUMER_USER:kycStatusDetails-status__SENDER',
                    },
                    'CANCELLED',
                  ],
                },
              ],
            },
            weight: 1,
            riskLevel: 'VERY_HIGH',
            riskScore: 100,
          },
        ],
      }),
      getTestRiskFactor({
        id: 'RF-3',
        type: 'BUSINESS',
        riskLevelLogic: [
          {
            logic: {
              and: [
                {
                  '==': [
                    {
                      var: 'BUSINESS_USER:kycStatusDetails-status__SENDER',
                    },
                    'EXPIRED',
                  ],
                },
              ],
            },
            weight: 1,
            riskLevel: 'HIGH',
            riskScore: 70,
          },
        ],
      }),
    ]
    test('userCountLimit filter', async () => {
      const mongoDb = await getMongoDbClient()
      const simulationTaskRepository = new SimulationTaskRepository(
        tenantId,
        mongoDb
      )
      const simulationResultRepository = new SimulationResultRepository(
        tenantId,
        mongoDb
      )
      const parameters: SimulationV8RiskFactorsParametersRequest = {
        parameters: [
          {
            name: 'test-simulation-1',
            parameters: testRiskFactors,
            description: 'Test Simulation 1',
            type: 'RISK_FACTORS_V8',
            riskScoringAlgorithm: {
              type: 'FORMULA_LEGACY_MOVING_AVG',
            },
            sampling: {
              sample: {
                type: 'RANDOM',
                sampleDetails: {
                  userCount: 2,
                },
              },
            },
          },
        ],
        type: 'RISK_FACTORS_V8',
      }
      const { taskIds, jobId } =
        await simulationTaskRepository.createSimulationJob(parameters)
      const testJob: BatchJobWithId = {
        type: 'SIMULATION_RISK_FACTORS_V8',
        tenantId,
        parameters: {
          taskId: taskIds[0],
          jobId,
          sampling: parameters.parameters[0].sampling ?? {
            sample: { usersCount: 'RANDOM' },
          },
        },
        jobId,
      }
      await jobRunnerHandler(testJob)

      const data: V8RiskSimulationJob | null =
        await simulationTaskRepository.getSimulationJob<V8RiskSimulationJob>(
          jobId
        )
      const results = await simulationResultRepository.getSimulationResults({
        taskId: taskIds[0],
        page: 1,
        pageSize: 10,
      })
      expect(data).toEqual({
        createdAt: expect.any(Number),
        jobId: expect.any(String),
        createdBy: 'test',
        internal: false,
        type: 'RISK_FACTORS_V8',
        iterations: expect.any(Array),
      })
      expect(data?.iterations[0].totalEntities).toEqual(2)
      expect(results.items).toHaveLength(2)
    })
    test('risk level filter', async () => {
      const mongoDb = await getMongoDbClient()
      const simulationTaskRepository = new SimulationTaskRepository(
        tenantId,
        mongoDb
      )
      const simulationResultRepository = new SimulationResultRepository(
        tenantId,
        mongoDb
      )
      const parameters: SimulationV8RiskFactorsParametersRequest = {
        parameters: [
          {
            name: 'test-simulation-1',
            parameters: testRiskFactors,
            description: 'Test Simulation 1',
            type: 'RISK_FACTORS_V8',
            riskScoringAlgorithm: {
              type: 'FORMULA_LEGACY_MOVING_AVG',
            },
            sampling: {
              sample: {
                type: 'RANDOM',
                sampleDetails: {
                  userCount: 5,
                  userRiskRange: {
                    startScore: 0,
                    endScore: 50,
                  },
                },
              },
            },
          },
        ],
        type: 'RISK_FACTORS_V8',
      }
      const { taskIds, jobId } =
        await simulationTaskRepository.createSimulationJob(parameters)
      const testJob: BatchJobWithId = {
        type: 'SIMULATION_RISK_FACTORS_V8',
        tenantId,
        parameters: {
          taskId: taskIds[0],
          jobId,
          sampling: parameters.parameters[0].sampling ?? {
            sample: { usersCount: 'RANDOM' },
          },
        },
        jobId,
      }
      await jobRunnerHandler(testJob)

      const data: V8RiskSimulationJob | null =
        await simulationTaskRepository.getSimulationJob<V8RiskSimulationJob>(
          jobId
        )
      const results = await simulationResultRepository.getSimulationResults({
        taskId: taskIds[0],
        page: 1,
        pageSize: 10,
      })
      expect(data).toEqual({
        createdAt: expect.any(Number),
        jobId: expect.any(String),
        createdBy: 'test',
        internal: false,
        type: 'RISK_FACTORS_V8',
        iterations: expect.any(Array),
      })
      expect(data?.iterations[0].totalEntities).toEqual(2)
      expect(results.items).toHaveLength(2)
      expect(
        (results.items as SimulationV8RiskFactorsResult[])
          .map((val) => val.userId)
          .sort()
      ).toEqual(['test-user-3', 'test-user-4'].sort())
    })
    test('user Id filter', async () => {
      const mongoDb = await getMongoDbClient()
      const simulationTaskRepository = new SimulationTaskRepository(
        tenantId,
        mongoDb
      )
      const simulationResultRepository = new SimulationResultRepository(
        tenantId,
        mongoDb
      )
      const parameters: SimulationV8RiskFactorsParametersRequest = {
        parameters: [
          {
            name: 'test-simulation-1',
            parameters: testRiskFactors,
            description: 'Test Simulation 1',
            type: 'RISK_FACTORS_V8',
            riskScoringAlgorithm: {
              type: 'FORMULA_LEGACY_MOVING_AVG',
            },
            sampling: {
              sample: {
                type: 'RANDOM',
                sampleDetails: {
                  userCount: 5,
                  userIds: ['test-user-1'],
                },
              },
            },
          },
        ],
        type: 'RISK_FACTORS_V8',
      }
      const { taskIds, jobId } =
        await simulationTaskRepository.createSimulationJob(parameters)
      const testJob: BatchJobWithId = {
        type: 'SIMULATION_RISK_FACTORS_V8',
        tenantId,
        parameters: {
          taskId: taskIds[0],
          jobId,
          sampling: parameters.parameters[0].sampling ?? {
            sample: { usersCount: 'RANDOM' },
          },
        },
        jobId,
      }
      await jobRunnerHandler(testJob)

      const data: V8RiskSimulationJob | null =
        await simulationTaskRepository.getSimulationJob<V8RiskSimulationJob>(
          jobId
        )
      const results = await simulationResultRepository.getSimulationResults({
        taskId: taskIds[0],
        page: 1,
        pageSize: 10,
      })
      expect(data).toEqual({
        createdAt: expect.any(Number),
        jobId: expect.any(String),
        createdBy: 'test',
        internal: false,
        type: 'RISK_FACTORS_V8',
        iterations: expect.any(Array),
      })
      expect(data?.iterations[0].totalEntities).toEqual(1)
      expect(results.items).toHaveLength(1)
      expect(
        (results.items as SimulationV8RiskFactorsResult[])
          .map((val) => val.userId)
          .sort()
      ).toEqual(['test-user-1'].sort())
    })
  })
})

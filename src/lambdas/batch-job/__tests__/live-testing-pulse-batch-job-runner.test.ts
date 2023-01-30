import { jobRunnerHandler } from '../app'
import { LiveTestingPulseBatchJob } from '@/@types/batch-job'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { LiveTestingTaskRepository } from '@/lambdas/console-api-live-testing/repositories/live-testing-task-repository'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { LiveTestPulseParameters } from '@/@types/openapi-internal/LiveTestPulseParameters'
import { createConsumerUsers, getTestUser } from '@/test-utils/user-test-utils'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { LiveTestingResultRepository } from '@/lambdas/console-api-live-testing/repositories/live-testing-result-repository'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

dynamoDbSetupHook()

describe('Live testing (Pulse) batch job runner', () => {
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

    const parameters: LiveTestPulseParameters = {
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
    }
    const liveTestingTaskRepository = new LiveTestingTaskRepository(
      tenantId,
      mongoDb
    )
    const liveTestingResultRepository = new LiveTestingResultRepository(
      tenantId,
      mongoDb
    )

    const taskId = await liveTestingTaskRepository.createLiveTestingTask(
      parameters
    )
    const testJob: LiveTestingPulseBatchJob = {
      type: 'LIVE_TESTING_PULSE',
      tenantId: tenantId,
      parameters: {
        taskId,
        ...parameters,
      },
    }

    await jobRunnerHandler(testJob)

    expect(
      await liveTestingTaskRepository.getLiveTestingTask(taskId)
    ).toMatchObject({
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
    })
    expect(
      await liveTestingResultRepository.getLiveTestingResults(taskId)
    ).toEqual([
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
        taskId,
        type: 'PULSE',
        userId: 'test-user-id-1',
      },
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
        taskId,
        type: 'PULSE',
        userId: 'test-user-id-2',
      },
    ])
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
    const transactionRepository = new TransactionRepository(tenantId, {
      mongoDb,
    })
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

    const parameters: LiveTestPulseParameters = {
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
        },
      ],
      sampling: {
        usersCount: 100,
      },
    }
    const liveTestingTaskRepository = new LiveTestingTaskRepository(
      tenantId,
      mongoDb
    )
    const liveTestingResultRepository = new LiveTestingResultRepository(
      tenantId,
      mongoDb
    )

    const taskId = await liveTestingTaskRepository.createLiveTestingTask(
      parameters
    )
    const testJob: LiveTestingPulseBatchJob = {
      type: 'LIVE_TESTING_PULSE',
      tenantId: tenantId,
      parameters: {
        taskId,
        ...parameters,
      },
    }

    await jobRunnerHandler(testJob)

    expect(
      await liveTestingTaskRepository.getLiveTestingTask(taskId)
    ).toMatchObject({
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
    })
    expect(
      await liveTestingResultRepository.getLiveTestingResults(taskId)
    ).toEqual([
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
        taskId,
        type: 'PULSE',
        userId: 'test-user-id-1',
      },
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
        taskId,
        type: 'PULSE',
        userId: 'test-user-id-2',
      },
    ])
  })
})

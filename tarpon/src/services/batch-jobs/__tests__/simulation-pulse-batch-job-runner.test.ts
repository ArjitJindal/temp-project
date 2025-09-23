import { jobRunnerHandler } from '@/lambdas/batch-job-runner/app'
import { BatchJobWithId } from '@/@types/batch-job'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { SimulationTaskRepository } from '@/services/simulation/repositories/simulation-task-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { createConsumerUsers, getTestUser } from '@/test-utils/user-test-utils'
import {
  DEFAULT_CLASSIFICATION_SETTINGS,
  RiskRepository,
} from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { SimulationResultRepository } from '@/services/simulation/repositories/simulation-result-repository'
import { SimulationRiskLevelsParametersRequest } from '@/@types/openapi-internal/SimulationRiskLevelsParametersRequest'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { SimulationRiskLevelsJob } from '@/@types/openapi-internal/SimulationRiskLevelsJob'
import { thunderSchemaSetupHook } from '@/test-utils/clickhouse-test-utils'
import { VersionHistoryTable } from '@/models/version-history'

dynamoDbSetupHook()
withFeatureHook(['SIMULATOR'])

describe('Simulation (Pulse) batch job runner', () => {
  const tenantId = getTestTenantId()
  thunderSchemaSetupHook(tenantId, [
    VersionHistoryTable.tableDefinition.tableName,
  ])
  test('new risk level classifications', async () => {
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
    await riskRepository.createOrUpdateRiskClassificationConfig(
      'test-simulation',
      [
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
      ]
    )
    const parameters: SimulationRiskLevelsParametersRequest = {
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

    const testJob: BatchJobWithId = {
      type: 'SIMULATION_PULSE',
      tenantId: tenantId,
      parameters: {
        taskId: taskIds[0],
        jobId,
        ...parameters.parameters[0],
      },
      jobId,
    }

    await jobRunnerHandler(testJob)
    const data: SimulationRiskLevelsJob | null =
      await simulationTaskRepository.getSimulationJob(jobId)

    expect(data).toMatchObject({
      iterations: [
        {
          progress: 1,
          statistics: {
            current: expect.arrayContaining([
              { count: 1, riskLevel: 'LOW', riskType: 'DRS' },
              { count: 1, riskLevel: 'MEDIUM', riskType: 'DRS' },
            ]),
            simulated: [{ count: 2, riskLevel: 'MEDIUM', riskType: 'DRS' }],
          },
          latestStatus: { status: 'SUCCESS', timestamp: expect.any(Number) },
          statuses: [
            { status: 'PENDING', timestamp: expect.any(Number) },
            { status: 'IN_PROGRESS', timestamp: expect.any(Number) },
            { status: 'IN_PROGRESS', timestamp: expect.any(Number) },
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
    const result = await simulationResultRepository.getSimulationResults({
      taskId: taskIds[0],
    })
    expect(result).toEqual({
      items: [
        {
          taskId: taskIds[0],
          type: 'PULSE',
          userId: 'test-user-id-2',
          userType: 'CONSUMER',
          userName: 'Baran Realblood Ozkan',
          current: { krs: null, drs: { riskScore: 80, riskLevel: 'MEDIUM' } },
          simulated: { krs: null, drs: { riskScore: 80, riskLevel: 'MEDIUM' } },
        },
        {
          taskId: taskIds[0],
          type: 'PULSE',
          userId: 'test-user-id-1',
          userType: 'CONSUMER',
          userName: 'Baran Realblood Ozkan',
          current: { krs: null, drs: { riskScore: 30, riskLevel: 'LOW' } },
          simulated: { krs: null, drs: { riskScore: 30, riskLevel: 'MEDIUM' } },
        },
      ],
      total: 2,
    })
  })
})

import { range } from 'lodash'
import { jobRunnerHandler } from '@/lambdas/batch-job/app'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { createConsumerUsers, getTestUser } from '@/test-utils/user-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import {
  bulkVerifyTransactions,
  setUpRulesHooks,
} from '@/test-utils/rule-test-utils'
import { CaseRepository } from '@/services/cases/repository'
import { SimulationTaskRepository } from '@/services/simulation/repositories/simulation-task-repository'
import { SimulationBeaconBatchJob } from '@/@types/batch-job'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { SimulationBeaconParameters } from '@/@types/openapi-internal/SimulationBeaconParameters'
import { TransactionAmountRuleParameters } from '@/services/rules-engine/transaction-rules/transaction-amount'
import { withLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'

dynamoDbSetupHook()

withFeatureHook(['SIMULATOR'])

const getRuleInstance = (threshold: number, id?: string): RuleInstance => {
  return {
    id,
    mode: 'LIVE_SYNC',
    type: 'TRANSACTION',
    ruleId: 'R-2',
    checksFor: ['Transaction amount'],
    ruleNameAlias: 'Transaction amount too high',
    ruleDescriptionAlias: 'Transaction amount is >= x in USD or equivalent',
    filters: {},
    parameters: { transactionAmountThreshold: { USD: threshold } },
    riskLevelParameters: {
      VERY_LOW: { transactionAmountThreshold: { USD: threshold } },
      VERY_HIGH: { transactionAmountThreshold: { USD: threshold } },
      HIGH: { transactionAmountThreshold: { USD: threshold } },
      MEDIUM: { transactionAmountThreshold: { USD: threshold } },
      LOW: { transactionAmountThreshold: { USD: threshold } },
    },
    action: 'FLAG',
    riskLevelActions: {
      VERY_LOW: 'FLAG',
      VERY_HIGH: 'FLAG',
      HIGH: 'FLAG',
      MEDIUM: 'FLAG',
      LOW: 'FLAG',
    },
    status: 'ACTIVE',
    createdAt: 1681206071155,
    updatedAt: 1681206071155,
    runCount: 0,
    hitCount: 0,
    casePriority: 'P1',
    nature: 'AML',
    labels: [],
  }
}

const getTransaction = (
  transactionId: string,
  amount: number,
  originator: string,
  beneficiary: string
) => {
  return getTestTransaction({
    transactionId,
    originAmountDetails: {
      country: 'IN',
      transactionAmount: amount,
      transactionCurrency: 'USD',
    },
    destinationAmountDetails: {
      country: 'IN',
      transactionAmount: amount,
      transactionCurrency: 'USD',
    },
    originUserId: originator,
    destinationUserId: beneficiary,
  })
}

const tenantId = getTestTenantId()

describe('Simulation Beacon Batch Job Runner', () => {
  withLocalChangeHandler()

  setUpRulesHooks(tenantId, [
    {
      defaultParameters: {
        transactionAmountThreshold: {
          USD: 4000,
        },
      } as TransactionAmountRuleParameters,
      ruleImplementationName: 'transaction-amount',
      type: 'TRANSACTION',
      defaultAction: 'FLAG',
      id: 'R-2',
    },
  ])

  setUpRulesHooks(`${tenantId}-test`, [
    {
      defaultParameters: {
        transactionAmountThreshold: {
          USD: 4000,
        },
      } as TransactionAmountRuleParameters,
      ruleImplementationName: 'transaction-amount',
      type: 'TRANSACTION',
      defaultAction: 'FLAG',
      id: 'R-2',
    },
  ])

  test('Should run the simulation beacon batch job', async () => {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const RULE_INSTANCE_SIMULATION = 'TEST_RULE_INSTANCE_SIMULATION'
    const caseRepository = new CaseRepository(tenantId, {
      mongoDb,
      dynamoDb,
    })
    const simulationTaskRepository = new SimulationTaskRepository(
      tenantId,
      mongoDb
    )
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })

    const testUsers = range(0, 10).map((i) =>
      getTestUser({
        userId: `test-user-${i}`,
      })
    )

    await createConsumerUsers(tenantId, testUsers)

    const transactions = range(0, 10).map((i) =>
      getTransaction(
        `test-transaction-${i}`,
        (i + 1) * 1000,
        `test-user-${i % 10}`,
        `test-user-${(i + 1) % 10}`
      )
    )

    const results = await bulkVerifyTransactions(tenantId, transactions)
    expect(results).toHaveLength(10)
    expect(results[0].hitRules).toHaveLength(0)
    expect(results[5].hitRules).toHaveLength(1)

    const cases = await caseRepository.getCases({})
    expect(cases.data).toHaveLength(8)

    await caseRepository.updateStatusOfCases(['C-1', 'C-3', 'C-5'], {
      userId: 'auth0|635f9aed8eca9c6258ce7f6e',
      timestamp: 1681209082803,
      reason: ['False positive'],
      caseStatus: 'CLOSED',
    })

    const casesAfterUpdate = await caseRepository.getCases({})
    expect(
      casesAfterUpdate.data.filter((c) => c.caseStatus === 'CLOSED')
    ).toHaveLength(3)

    const simulationRuleInstance = getRuleInstance(
      6000,
      RULE_INSTANCE_SIMULATION
    )

    const parameters: SimulationBeaconParameters[] = [
      {
        type: 'BEACON',
        ruleInstance: simulationRuleInstance,
        name: 'Test Simulation',
        description: 'Test Simulation',
      },
    ]

    const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()
    expect(ruleInstances).toHaveLength(1)

    const ruleInstance = ruleInstances[0]

    const { jobId, taskIds } =
      await simulationTaskRepository.createSimulationJob({
        type: 'BEACON',
        defaultRuleInstance: ruleInstance,
        parameters,
      })

    const testJob: SimulationBeaconBatchJob = {
      type: 'SIMULATION_BEACON',
      tenantId,
      parameters: {
        jobId,
        taskId: taskIds[0],
        ...parameters[0],
        defaultRuleInstance: ruleInstance,
      },
    }

    await jobRunnerHandler(testJob)

    const simulatedData = await simulationTaskRepository.getSimulationJob(jobId)
    expect(simulatedData).toBeDefined()
    expect(simulatedData?.iterations[0].statistics).toMatchObject({
      current: {
        totalCases: 8,
        falsePositivesCases: 3,
        usersHit: 8,
        transactionsHit: 7,
      },
      simulated: {
        totalCases: 6,
        falsePositivesCases: 2,
        usersHit: 6,
        transactionsHit: 5,
      },
    })
  })

  test('Should run the simulation beacon batch job for demo mode with specified number of iterations', async () => {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = await getDynamoDbClient()
    const demoTenantId = `${tenantId}-test`
    const RULE_INSTANCE_SIMULATION = 'TEST_RULE_INSTANCE_SIMULATION'
    const simulationTaskRepository = new SimulationTaskRepository(
      demoTenantId,
      mongoDb
    )
    const ruleInstanceRepository = new RuleInstanceRepository(demoTenantId, {
      dynamoDb,
    })

    const simulationRuleInstance = getRuleInstance(
      6000,
      RULE_INSTANCE_SIMULATION
    )

    const parameters: SimulationBeaconParameters[] = [
      {
        type: 'BEACON',
        ruleInstance: simulationRuleInstance,
        name: 'Test Simulation 1',
        description: 'Test Simulation',
      },
      {
        type: 'BEACON',
        ruleInstance: simulationRuleInstance,
        name: 'Test Simulation 2',
        description: 'Test Simulation',
      },
      {
        type: 'BEACON',
        ruleInstance: simulationRuleInstance,
        name: 'Test Simulation 3',
        description: 'Test Simulation',
      },
    ]

    const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()
    expect(ruleInstances).toHaveLength(1)

    const ruleInstance = ruleInstances[0]

    const { jobId, taskIds } =
      await simulationTaskRepository.createSimulationJob({
        type: 'BEACON',
        defaultRuleInstance: ruleInstance,
        parameters,
      })

    expect(taskIds).toHaveLength(3)
    const demoJob = await simulationTaskRepository.getSimulationJob(jobId)

    expect(demoJob?.iterations).toHaveLength(taskIds.length)
    demoJob?.iterations.forEach((iteration) => {
      expect(taskIds).toContain(iteration.taskId)
    })
  })
})

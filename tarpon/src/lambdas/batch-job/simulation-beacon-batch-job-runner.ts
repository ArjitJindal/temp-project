import pMap from 'p-map'
import _ from 'lodash'
import { SimulationTaskRepository } from '../console-api-simulation/repositories/simulation-task-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { SimulationBeaconBatchJob } from '@/@types/batch-job'
import { RulesEngineService } from '@/services/rules-engine'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { SimulationBeaconParameters } from '@/@types/openapi-internal/SimulationBeaconParameters'
import { ExecutedRulesResult } from '@/@types/openapi-internal/ExecutedRulesResult'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { Case } from '@/@types/openapi-internal/Case'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { SimulationBeaconStatisticsResult } from '@/@types/openapi-internal/SimulationBeaconStatisticsResult'
import { logger } from '@/core/logger'

const MAX_TRANSACTIONS = 10000
const TIMEOUT = 14 * 60 * 1000

type SimulatedTransactionHit = {
  transaction: InternalTransaction
  executedRules: ExecutedRulesResult
}

export class SimulationBeaconBatchJobRunner extends BatchJobRunner {
  private transactionRepository?: MongoDbTransactionRepository
  private rulesEngineService?: RulesEngineService
  private casesRepository?: CaseRepository
  private timeout = false

  private startTimer() {
    setTimeout(() => {
      this.timeout = true
    }, TIMEOUT)
  }

  protected async run(job: SimulationBeaconBatchJob): Promise<any> {
    this.startTimer()
    const { tenantId, awsCredentials, parameters } = job
    const dynamoDb = await getDynamoDbClient(awsCredentials)
    const mongoDb = await getMongoDbClient()
    const rulesEngineService = new RulesEngineService(tenantId, dynamoDb)
    const simulationRepository = new SimulationTaskRepository(tenantId, mongoDb)
    const caseRepository = new CaseRepository(tenantId, { mongoDb })
    const transactionRepository = new MongoDbTransactionRepository(
      tenantId,
      mongoDb
    )

    this.rulesEngineService = rulesEngineService
    this.casesRepository = caseRepository
    this.transactionRepository = transactionRepository

    await simulationRepository.updateTaskStatus(
      parameters.taskId,
      'IN_PROGRESS'
    )

    try {
      // get transactions
      const transactions = await this.getTransactions(parameters.sampling)

      // simulate transactions
      const executionDetails = await this.simulateTransactions(
        transactions,
        parameters
      )

      const simulationBeaconStatistics =
        await this.getSimulationBeaconStatistics(
          executionDetails,
          transactions,
          parameters.defaultRuleInstance
        )

      await simulationRepository.updateStatistics(
        parameters.taskId,
        simulationBeaconStatistics
      )

      await simulationRepository.updateTaskStatus(parameters.taskId, 'SUCCESS')
    } catch (error) {
      await simulationRepository.updateTaskStatus(parameters.taskId, 'FAILED')
      throw error
    }
  }

  private async getSimulationBeaconStatistics(
    executionDetails: SimulatedTransactionHit[],
    transactions: InternalTransaction[],
    defaultRuleInstance: RuleInstance
  ): Promise<SimulationBeaconStatisticsResult> {
    const executedTransactionIds = new Set(
      executionDetails.map((d) => d.transaction.transactionId)
    )
    const actualTransactionsRan = transactions.filter((t) =>
      executedTransactionIds.has(t.transactionId)
    )
    const casesByTransactions = await this.getCasesFromTransactions(
      actualTransactionsRan,
      defaultRuleInstance
    )

    const simulationUsersHit = this.simulationUsersHit(executionDetails)

    const originalFalsePositiveUsers =
      this.getFalsePositiveCases(casesByTransactions)

    const falsePositiveCasesCountSimulated =
      this.getSimulatedTransactionsFalsePositiveCount(
        originalFalsePositiveUsers,
        executionDetails
      )

    const totalTransactions =
      (await this.transactionRepository?.getAllTransactionsCount()) ?? 0

    const ratio = Math.max(1, totalTransactions / actualTransactionsRan.length) // extrapolated ratio

    const transactionsHit = defaultRuleInstance.id
      ? this.distinctTransactionsHitCount(
          actualTransactionsRan,
          defaultRuleInstance.id
        )
      : 0

    const transactionsHitSimulated =
      this.numberOfTransactionsHit(executionDetails)

    const usersHit = defaultRuleInstance.id
      ? this.getUsersHitByTransactions(transactions, defaultRuleInstance.id)
          .length
      : 0

    return {
      current: {
        totalCases: Math.round(usersHit * ratio),
        falsePositivesCases: Math.round(
          originalFalsePositiveUsers.length * ratio
        ),
        usersHit: Math.round(usersHit * ratio),
        transactionsHit: Math.round(transactionsHit * ratio),
      },
      simulated: {
        totalCases: Math.round(simulationUsersHit.length * ratio),
        falsePositivesCases: Math.round(
          falsePositiveCasesCountSimulated * ratio
        ),
        usersHit: Math.round(simulationUsersHit.length * ratio),
        transactionsHit: Math.round(transactionsHitSimulated * ratio),
      },
    }
  }

  private getUsersHitByTransactions(
    transactions: InternalTransaction[],
    ruleInstanceId: string
  ): string[] {
    const userIds = transactions.flatMap((transaction) => {
      const hit = transaction.hitRules.find(
        (ruleHit) => ruleHit.ruleInstanceId === ruleInstanceId
      )
      if (!hit) {
        return []
      }
      const userIds = []
      if (!hit.ruleHitMeta?.hitDirections?.length) {
        return [transaction.originUserId, transaction.destinationUserId]
      }
      if (hit.ruleHitMeta?.hitDirections.includes('ORIGIN')) {
        userIds.push(transaction.originUserId)
      }
      if (hit.ruleHitMeta?.hitDirections.includes('DESTINATION')) {
        userIds.push(transaction.destinationUserId)
      }
      return userIds
    })

    return [...new Set(userIds)].filter((userId) => userId != null) as string[]
  }

  private numberOfTransactionsHit(
    simulationTransactionsHit: SimulatedTransactionHit[]
  ): number {
    return simulationTransactionsHit.filter((executionResult) => {
      const { executedRules } = executionResult
      return executedRules.ruleHit === true
    }).length
  }

  private simulationUsersHit(
    executionDetails: SimulatedTransactionHit[]
  ): string[] {
    return _.chain(executionDetails)
      .flatMap(({ executedRules, transaction }) => {
        const ruleHitDirection = executedRules.ruleHitMeta?.hitDirections
        return [
          ...(ruleHitDirection?.includes('ORIGIN')
            ? [transaction.originUserId]
            : []),
          ...(ruleHitDirection?.includes('DESTINATION')
            ? [transaction.destinationUserId]
            : []),
        ]
      })
      .uniq()
      .compact()
      .value()
  }

  private async getTransactions(
    sampling: SimulationBeaconParameters['sampling']
  ): Promise<InternalTransaction[]> {
    const transactionRepository = this.transactionRepository
    if (transactionRepository) {
      const count = Math.min(
        sampling?.transactionsCount ?? Number.MAX_SAFE_INTEGER,
        MAX_TRANSACTIONS
      )
      const transactions = await transactionRepository.getLastNTransactions(
        count
      )
      return transactions
    }
    return []
  }

  private async simulateTransactions(
    transactions: InternalTransaction[],
    parameters: SimulationBeaconParameters
  ): Promise<SimulatedTransactionHit[]> {
    const ruleInstance = parameters.ruleInstance
    const rulesEngineService = this.rulesEngineService
    if (!rulesEngineService) {
      return []
    }
    const onePercentTransactionsCount = transactions.length * 0.01
    let processedTransactionsCount = 0
    const executionResults = await pMap(
      transactions,
      async (transaction) => {
        if (this.timeout) {
          return
        }
        try {
          const executedRules =
            await rulesEngineService.verifyTransactionForSimulation(
              transaction,
              ruleInstance
            )

          return { transaction, executedRules }
        } catch (e) {
          logger.error(e)
        } finally {
          if (processedTransactionsCount % onePercentTransactionsCount === 0) {
            const progress =
              (processedTransactionsCount / transactions.length) * 100
            logger.info(
              `Progress: ${progress} % (${processedTransactionsCount} / ${transactions.length})`
            )
          }
          processedTransactionsCount += 1
        }
      },
      { concurrency: 10 }
    )

    const filteredExecutionResults = executionResults.filter(
      (executedRule) => executedRule?.executedRules
    ) as SimulatedTransactionHit[]

    return filteredExecutionResults
  }

  private getFalsePositiveCases(cases: Case[]): string[] {
    /**
     * To get the false positive cases we filter the cases that are closed
     * and have the reason False positive
     */
    const falsePostiveCases = cases.filter(
      (caseItem) =>
        caseItem.caseStatus === 'CLOSED' &&
        caseItem.lastStatusChange?.reason?.includes('False positive')
    )

    const uniqueUsers = _.chain(falsePostiveCases)
      .flatMap((caseItem) => [
        caseItem.caseUsers?.origin?.userId,
        caseItem.caseUsers?.destination?.userId,
      ])
      .compact()
      .uniq()
      .value()

    return uniqueUsers
  }

  private async getCasesFromTransactions(
    transactions: InternalTransaction[],
    ruleInstance: RuleInstance
  ): Promise<Case[]> {
    const transactionIds = transactions.map(
      (transaction) => transaction.transactionId
    )
    /**
     * To get the cases hit by the rule we need to get the cases that have
     * the rule instance id and the transaction id
     */
    if (this.casesRepository) {
      const cases = await this.casesRepository.getCasesByTransactionIds(
        transactionIds,
        { 'alerts.ruleInstanceId': ruleInstance.id }
      )
      return cases
    }
    return []
  }

  private distinctTransactionsHitCount(
    transactions: InternalTransaction[],
    ruleInstanceId: string
  ): number {
    /**
     * To get the number of transactions hit by the rule we need to filter
     * the transactions that have the rule id in the hit rules
     * and then get the length of the array
     */
    return transactions.filter((transaction) =>
      transaction.hitRules.find(
        (rule) => rule.ruleInstanceId === ruleInstanceId
      )
    ).length
  }

  private getSimulatedTransactionsFalsePositiveCount(
    originalFalsePositiveUsers: string[],
    executionDetails: SimulatedTransactionHit[]
  ): number {
    const falsePositiveUsers = new Set<string>()

    for (const executionDetail of executionDetails) {
      if (!executionDetail.executedRules.ruleHit) continue

      const { originUserId, destinationUserId } = executionDetail.transaction

      if (originUserId && originalFalsePositiveUsers.includes(originUserId)) {
        falsePositiveUsers.add(originUserId)
      }

      if (
        destinationUserId &&
        originalFalsePositiveUsers.includes(destinationUserId)
      ) {
        falsePositiveUsers.add(destinationUserId)
      }
    }

    return falsePositiveUsers.size
  }
}

import pMap from 'p-map'

import { chain, compact, uniq, uniqBy } from 'lodash'
import { SimulationTaskRepository } from '../console-api-simulation/repositories/simulation-task-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { SimulationBeaconBatchJob } from '@/@types/batch-job'
import { RulesEngineService } from '@/services/rules-engine'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { SimulationBeaconParameters } from '@/@types/openapi-internal/SimulationBeaconParameters'
import { ExecutedRulesResult } from '@/@types/openapi-internal/ExecutedRulesResult'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { SimulationBeaconStatisticsResult } from '@/@types/openapi-internal/SimulationBeaconStatisticsResult'
import { logger } from '@/core/logger'
import { UserRepository } from '@/services/users/repositories/user-repository'

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
  private userRepository?: UserRepository
  private timeout = false

  private startTimer() {
    setTimeout(() => {
      this.timeout = true
    }, TIMEOUT)
  }

  protected async run(job: SimulationBeaconBatchJob): Promise<void> {
    this.startTimer()
    const { tenantId, awsCredentials, parameters } = job
    const dynamoDb = getDynamoDbClient(awsCredentials)
    const mongoDb = await getMongoDbClient()
    const rulesEngineService = new RulesEngineService(tenantId, dynamoDb)
    const simulationRepository = new SimulationTaskRepository(tenantId, mongoDb)
    const caseRepository = new CaseRepository(tenantId, { mongoDb })
    const userRepository = new UserRepository(tenantId, { mongoDb })
    const transactionRepository = new MongoDbTransactionRepository(
      tenantId,
      mongoDb
    )

    this.rulesEngineService = rulesEngineService
    this.casesRepository = caseRepository
    this.transactionRepository = transactionRepository
    this.userRepository = userRepository

    await simulationRepository.updateTaskStatus(
      parameters.taskId,
      'IN_PROGRESS'
    )

    try {
      // get transactions
      const transactions = await this.getTransactions(
        parameters.sampling,
        parameters.defaultRuleInstance
      )

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

      await Promise.all([
        simulationRepository.updateStatistics(
          parameters.taskId,
          simulationBeaconStatistics
        ),
        simulationRepository.updateTaskStatus(parameters.taskId, 'SUCCESS'),
      ])
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

    const usersByTransactionsRan = this.getUsersByTransactionsRan(
      actualTransactionsRan
    )

    const simulationUsersHit = this.simulationUsersHit(executionDetails)

    const [
      totalUsers,
      originalFalsePositiveUsers,
      totalTransactions,
      transactionsHit,
      usersHit,
    ] = await Promise.all([
      this.userRepository?.getUsersCount() ?? 0,
      defaultRuleInstance.id
        ? this.getFalsePositiveUserIdsByRuleInstance(defaultRuleInstance.id)
        : [],
      this.transactionRepository?.getAllTransactionsCount() ?? 0,
      defaultRuleInstance.id
        ? this.actualTransactionsHitCount(defaultRuleInstance.id)
        : 0,
      defaultRuleInstance.id
        ? this.actualUsersHitCount(defaultRuleInstance.id)
        : 0,
    ])

    const falsePositiveCasesCountSimulated =
      this.getSimulatedTransactionsFalsePositiveCount(
        originalFalsePositiveUsers,
        executionDetails
      )

    const transactionExtrapolationRatio = Math.max(
      1,
      totalTransactions / actualTransactionsRan.length
    ) // extrapolated ratio

    const userExtrapolationRatio = Math.max(
      1,
      totalUsers / usersByTransactionsRan
    )

    const transactionsHitSimulated =
      this.numberOfTransactionsHit(executionDetails)

    return {
      current: {
        totalCases: usersHit,
        falsePositivesCases: originalFalsePositiveUsers.length,
        usersHit,
        transactionsHit,
      },
      simulated: {
        totalCases: Math.round(
          simulationUsersHit.length * userExtrapolationRatio
        ),
        falsePositivesCases: Math.round(
          falsePositiveCasesCountSimulated * userExtrapolationRatio
        ),
        usersHit: Math.round(
          simulationUsersHit.length * userExtrapolationRatio
        ),
        transactionsHit: Math.round(
          transactionsHitSimulated * transactionExtrapolationRatio
        ),
      },
    }
  }

  private async actualUsersHitCount(ruleInstanceId: string): Promise<number> {
    return (
      (await this.casesRepository?.getUserCountByRuleInstance(
        ruleInstanceId
      )) ?? 0
    )
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
    return chain(executionDetails)
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
    sampling: SimulationBeaconParameters['sampling'],
    ruleInstance: RuleInstance
  ): Promise<InternalTransaction[]> {
    const transactionRepository = this.transactionRepository

    const ruleHitRatio =
      ruleInstance.hitCount && ruleInstance.runCount
        ? ruleInstance.hitCount / ruleInstance.runCount
        : 0

    const totalCount = Math.min(
      sampling?.transactionsCount ?? Number.MAX_SAFE_INTEGER,
      MAX_TRANSACTIONS
    )

    const hitCount = Math.ceil(totalCount * ruleHitRatio) // Will give as 1 hit at least
    const missCount = totalCount - hitCount

    if (transactionRepository) {
      const [transactionsHit, transactionsMiss] = await Promise.all([
        hitCount > 0 && ruleInstance.id
          ? transactionRepository.getLastNTransactionsHitByRuleInstance(
              hitCount,
              ruleInstance.id
            )
          : ([] as InternalTransaction[]),
        missCount > 0
          ? transactionRepository.getLastNTransactionsNotHitByRuleInstance(
              missCount,
              ruleInstance.id
            )
          : ([] as InternalTransaction[]),
      ])

      logger.info(
        `Transactions hit: ${transactionsHit.length}, Transactions miss: ${transactionsMiss.length}`
      )
      const allTransactionsHit = await this.filterHighFrequencyUsers(
        transactionsHit,
        transactionRepository,
        ruleInstance,
        hitCount
      )

      return uniqBy(
        [...allTransactionsHit, ...transactionsMiss],
        'transactionId'
      )
    }
    return []
  }

  private async filterHighFrequencyUsers(
    transactionsHit: InternalTransaction[],
    transactionRepository: MongoDbTransactionRepository,
    ruleInstance: RuleInstance,
    hitCount: number
  ): Promise<InternalTransaction[]> {
    const THRESHOLD_COUNT = 200_000

    const uniqueDestinationUserIds = compact(
      uniq(transactionsHit.map((t) => t.destinationUserId))
    )

    logger.info(
      `Number of unique destination users: ${uniqueDestinationUserIds.length}`
    )

    const numberOfUsersWithHighTransactionsCount = await Promise.all(
      uniqueDestinationUserIds.map(async (userId) => {
        return {
          userId,
          count: await transactionRepository.getTransactionsCountByQuery(
            { destinationUserId: userId },
            THRESHOLD_COUNT
          ),
        }
      })
    )

    const userIdsWithHighTransactionsCount =
      numberOfUsersWithHighTransactionsCount
        .filter(({ count }) => count >= THRESHOLD_COUNT)
        .map(({ userId }) => userId)

    logger.info(
      `Number of users with high transactions count: ${numberOfUsersWithHighTransactionsCount.length}`
    )

    const transactionsHitFiltered = userIdsWithHighTransactionsCount.length
      ? transactionsHit.filter(
          (transaction) =>
            transaction.destinationUserId == null ||
            !userIdsWithHighTransactionsCount.includes(
              transaction.destinationUserId
            )
        )
      : transactionsHit

    logger.info(
      `Number of transactions hit after filtering high frequency users: ${transactionsHitFiltered.length}`
    )

    const newTransactionsHit =
      hitCount - transactionsHitFiltered.length > 0 && ruleInstance.id
        ? await transactionRepository.getLastNTransactionsHitByRuleInstance(
            hitCount - transactionsHitFiltered.length,
            ruleInstance.id,
            userIdsWithHighTransactionsCount,
            transactionsHitFiltered.map((t) => t.transactionId)
          )
        : []

    logger.info(`Number of new transactions hit: ${newTransactionsHit.length}`)

    const allTransactionsHit =
      transactionsHitFiltered.concat(newTransactionsHit)

    return allTransactionsHit
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

  private async getFalsePositiveUserIdsByRuleInstance(
    ruleInstanceId: string
  ): Promise<string[]> {
    const falsePositiveCases =
      await this.casesRepository?.getFalsePositiveUserIdsByRuleInstance(
        ruleInstanceId
      )

    return falsePositiveCases ?? []
  }

  private async actualTransactionsHitCount(
    ruleInstanceId: string
  ): Promise<number> {
    return (
      (await this.transactionRepository?.getTransactionsCountByQuery({
        'hitRules.ruleInstanceId': ruleInstanceId,
      })) ?? 0
    )
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

  private getUsersByTransactionsRan(
    transactions: InternalTransaction[]
  ): number {
    const users = new Set()
    transactions.forEach((transaction) => {
      users.add(transaction.originUserId)
      users.add(transaction.destinationUserId)
    })
    return users.size
  }
}

import pMap from 'p-map'
import PQueue from 'p-queue'
import { chain, chunk, compact, memoize, uniq, uniqBy } from 'lodash'
import { getRiskLevelFromScore } from '@flagright/lib/utils'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { SimulationResultRepository } from '../simulation/repositories/simulation-result-repository'
import { RiskRepository } from '../risk-scoring/repositories/risk-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { SimulationBeaconBatchJob } from '@/@types/batch-job'
import { RulesEngineService } from '@/services/rules-engine'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { SimulationBeaconParameters } from '@/@types/openapi-internal/SimulationBeaconParameters'
import { ExecutedRulesResult } from '@/@types/openapi-internal/ExecutedRulesResult'
import { CaseRepository } from '@/services/cases/repository'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { SimulationBeaconStatisticsResult } from '@/@types/openapi-internal/SimulationBeaconStatisticsResult'
import { logger } from '@/core/logger'
import { UserRepository } from '@/services/users/repositories/user-repository'
import dayjs from '@/utils/dayjs'
import { traceable } from '@/core/xray'
import { SimulationTaskRepository } from '@/services/simulation/repositories/simulation-task-repository'
import { SimulationBeaconSampling } from '@/@types/openapi-internal/SimulationBeaconSampling'
import { SimulationBeaconTransactionResult } from '@/@types/openapi-internal/SimulationBeaconTransactionResult'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { getUserName } from '@/utils/helpers'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { SimulationBeaconResultUser } from '@/@types/openapi-internal/SimulationBeaconResultUser'

const MAX_TRANSACTIONS = 10000

type SimulatedTransactionHit = {
  transaction: InternalTransaction
  executedRules: ExecutedRulesResult
}

@traceable
export class SimulationBeaconBatchJobRunner extends BatchJobRunner {
  private transactionRepository?: MongoDbTransactionRepository
  private rulesEngineService?: RulesEngineService
  private casesRepository?: CaseRepository
  private simulationResultRepository?: SimulationResultRepository
  private userRepository?: UserRepository
  private executionDetails: SimulatedTransactionHit[] = []
  private riskRepository?: RiskRepository

  protected async run(job: SimulationBeaconBatchJob): Promise<void> {
    const { tenantId, awsCredentials, parameters } = job
    const dynamoDb = getDynamoDbClient(awsCredentials)
    const mongoDb = await getMongoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const rulesEngineService = new RulesEngineService(
      tenantId,
      dynamoDb,
      logicEvaluator
    )
    const simulationRepository = new SimulationTaskRepository(tenantId, mongoDb)
    const caseRepository = new CaseRepository(tenantId, { mongoDb })
    const transactionRepository = new MongoDbTransactionRepository(
      tenantId,
      mongoDb,
      dynamoDb
    )
    const riskRepository = new RiskRepository(tenantId, {
      dynamoDb,
      mongoDb,
    })
    const simulationResultRepository = new SimulationResultRepository(
      tenantId,
      mongoDb
    )
    const userRepository = new UserRepository(tenantId, {
      mongoDb,
    })

    this.rulesEngineService = rulesEngineService
    this.casesRepository = caseRepository
    this.transactionRepository = transactionRepository
    this.simulationResultRepository = simulationResultRepository
    this.userRepository = userRepository
    this.riskRepository = riskRepository
    await simulationRepository.updateTaskStatus(
      parameters.taskId,
      'IN_PROGRESS'
    )

    try {
      // get transactions
      const timestampFilter = parameters.sampling?.filters
        ? {
            beforeTimestamp: parameters.sampling?.filters?.beforeTimestamp,
            afterTimestamp: parameters.sampling?.filters?.afterTimestamp,
          }
        : undefined

      const transactions = await this.getTransactions(
        parameters.sampling,
        parameters.defaultRuleInstance,
        timestampFilter
      )

      await this.simulateTransactions(
        transactions,
        parameters,
        async (progress: number) => {
          const simulationBeaconStatistics =
            await this.getSimulationBeaconStatistics(
              this.executionDetails,
              transactions,
              parameters.defaultRuleInstance,
              parameters.sampling?.filters
            )
          await Promise.all([
            simulationRepository.updateTaskStatus(
              parameters.taskId,
              'IN_PROGRESS',
              progress,
              transactions.length
            ),
            simulationRepository.updateStatistics<SimulationBeaconStatisticsResult>(
              parameters.taskId,
              simulationBeaconStatistics
            ),
          ])
        }
      )
      const riskClassificationValues =
        await this.riskRepository?.getRiskClassificationValues()

      await this.insertSimulationResults(
        this.executionDetails,
        parameters,
        riskClassificationValues
      )
      await simulationRepository.updateTaskStatus(parameters.taskId, 'SUCCESS')
    } catch (error) {
      await simulationRepository.updateTaskStatus(parameters.taskId, 'FAILED')
      throw error
    }
  }

  private async getTransactionsCount(
    filters?: SimulationBeaconSampling['filters']
  ): Promise<number> {
    if (!this.transactionRepository) {
      return 0
    }

    if (filters) {
      return this.transactionRepository.getTransactionsCountByQuery({
        timestamp: {
          $lte: filters.beforeTimestamp,
          $gte: filters.afterTimestamp,
        },
      })
    }

    return this.transactionRepository?.getAllTransactionsCount()
  }

  private async getSimulationBeaconStatistics(
    executionDetails: SimulatedTransactionHit[],
    transactions: InternalTransaction[],
    defaultRuleInstance: RuleInstance,
    filters?: SimulationBeaconSampling['filters']
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
      this.transactionRepository?.getUsersCount(filters) ?? 0, // Count of Users in that particular time range ran by transactions
      defaultRuleInstance.id
        ? this.getFalsePositiveUserIdsByRuleInstance(defaultRuleInstance.id)
        : [],
      this.getTransactionsCount(filters),
      defaultRuleInstance.id
        ? this.actualTransactionsHitCount(defaultRuleInstance.id, filters)
        : 0,
      defaultRuleInstance.id
        ? this.getActualUsersHit(defaultRuleInstance.id)
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
      .flatMap(({ executedRules, transaction }) =>
        this.extractHitUserIds(executedRules, transaction)
      )
      .uniq()
      .compact()
      .value()
  }

  private async getActualUsersHit(ruleInstanceId: string): Promise<number> {
    const usersHit = await this.casesRepository?.getAllUsersCountByRuleInstance(
      ruleInstanceId
    )
    return usersHit ?? 0
  }

  private extractHitUserIds(
    executedRules: ExecutedRulesResult,
    transaction: InternalTransaction
  ): (string | undefined)[] {
    const { originUserId, destinationUserId } = transaction
    const ruleHitDirection = executedRules.ruleHitMeta?.hitDirections
    if (!ruleHitDirection?.length && executedRules.ruleHit) {
      return [originUserId, destinationUserId]
    }
    return [
      ...(ruleHitDirection?.includes('ORIGIN') ? [originUserId] : []),
      ...(ruleHitDirection?.includes('DESTINATION') ? [destinationUserId] : []),
    ]
  }

  private async getTransactions(
    sampling: SimulationBeaconParameters['sampling'],
    ruleInstance: RuleInstance,
    filters?: SimulationBeaconSampling['filters']
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
          ? transactionRepository.getNTransactionsHitByRuleInstance(
              hitCount,
              ruleInstance.id,
              [],
              [],
              filters
            )
          : ([] as InternalTransaction[]),
        missCount > 0
          ? transactionRepository.getNTransactionsNotHitByRuleInstance(
              missCount,
              ruleInstance.id,
              [],
              [],
              filters
            )
          : ([] as InternalTransaction[]),
      ])

      logger.info(
        `Transactions hit: ${transactionsHit.length}, Transactions miss: ${transactionsMiss.length}`
      )
      const targetTransactions =
        await this.filterOutHighFrequencyUserTransactions(
          transactionsHit,
          transactionsMiss,
          transactionRepository,
          ruleInstance
        )

      return uniqBy(targetTransactions, 'transactionId')
    }
    return []
  }

  private async filterOutHighFrequencyUserTransactions(
    originalTransactionsHit: InternalTransaction[],
    originalTransactionsMiss: InternalTransaction[],
    transactionRepository: MongoDbTransactionRepository,
    ruleInstance: RuleInstance,
    filters?: SimulationBeaconSampling['filters']
  ): Promise<InternalTransaction[]> {
    // If a transaction's destination user has more than 200k txs in the past 5 days, we
    // skip processing the transaction.
    // NOTE: This is a workaround fix for preventing loading too many transactions into memory when
    // running the rules.
    const HIGH_FREQUENCY_TRANSACTIONS_THRESHOLD = {
      days: 5,
      count: 200_000,
    }

    const uniqueDestinationUserIds = compact(
      uniq(
        originalTransactionsHit
          .concat(originalTransactionsMiss)
          .map((t) => t.destinationUserId)
      )
    )

    logger.info(
      `Number of unique destination users: ${uniqueDestinationUserIds.length}`
    )

    /**
     * If TimeRange is not provided, we will use the current time as the end time.
     * If TimeRange is provided, we will use
     *  - the start time if it is greater than the threshold days from the end time
     *  - the end time if it is less than the threshold days from the end time
     */
    const timeRangeFilter = {
      $gte: dayjs(filters?.beforeTimestamp)
        .subtract(HIGH_FREQUENCY_TRANSACTIONS_THRESHOLD.days, 'day')
        .valueOf(),

      $lte: dayjs(filters?.beforeTimestamp).valueOf(),
    }

    const userIdsToFilterOut: string[] = []
    for (const userIdsChunk of chunk(uniqueDestinationUserIds, 100)) {
      await Promise.all(
        userIdsChunk.map(async (userId) => {
          const count = await transactionRepository.getTransactionsCountByQuery(
            { destinationUserId: userId, timestamp: timeRangeFilter },
            HIGH_FREQUENCY_TRANSACTIONS_THRESHOLD.count
          )
          if (count >= HIGH_FREQUENCY_TRANSACTIONS_THRESHOLD.count) {
            userIdsToFilterOut.push(userId)
          }
        })
      )
    }

    logger.info(
      `Number of users with high transactions count: ${userIdsToFilterOut.length}`
    )

    const transactionsHitFiltered = userIdsToFilterOut.length
      ? originalTransactionsHit.filter(
          (transaction) =>
            !transaction.destinationUserId ||
            !userIdsToFilterOut.includes(transaction.destinationUserId)
        )
      : originalTransactionsHit
    const transactionsMissFiltered = userIdsToFilterOut.length
      ? originalTransactionsMiss.filter(
          (transaction) =>
            !transaction.destinationUserId ||
            !userIdsToFilterOut.includes(transaction.destinationUserId)
        )
      : originalTransactionsMiss

    logger.info(
      `Number of filtered transactions: ${transactionsHitFiltered.length} (hit), ${transactionsMissFiltered.length} (hit)`
    )

    const additionalTransactionsHit =
      originalTransactionsHit.length - transactionsHitFiltered.length > 0 &&
      ruleInstance.id
        ? await transactionRepository.getNTransactionsHitByRuleInstance(
            originalTransactionsHit.length - transactionsHitFiltered.length,
            ruleInstance.id,
            userIdsToFilterOut,
            transactionsHitFiltered.map((t) => t.transactionId)
          )
        : []
    const additionalTransactionsMiss =
      originalTransactionsMiss.length - transactionsMissFiltered.length > 0 &&
      ruleInstance.id
        ? await transactionRepository.getNTransactionsNotHitByRuleInstance(
            originalTransactionsMiss.length - transactionsMissFiltered.length,
            ruleInstance.id,
            userIdsToFilterOut,
            transactionsMissFiltered.map((t) => t.transactionId)
          )
        : []

    logger.info(
      `Number of additional transactionss: ${additionalTransactionsHit.length} (hit), ${additionalTransactionsMiss.length} (miss)`
    )

    return transactionsHitFiltered
      .concat(additionalTransactionsHit)
      .concat(transactionsMissFiltered)
      .concat(additionalTransactionsMiss)
  }

  private async simulateTransactions(
    transactions: InternalTransaction[],
    parameters: SimulationBeaconParameters,
    onProgressChange: (progress: number) => Promise<void>
  ) {
    const ruleInstance = parameters.ruleInstance
    const rulesEngineService = this.rulesEngineService
    if (!rulesEngineService) {
      return []
    }
    const onePercentTransactionsCount = Math.floor(transactions.length * 0.01)
    let processedTransactionsCount = 0
    const progressQueue = new PQueue({ concurrency: 1 })
    await pMap(
      transactions,
      async (transaction) => {
        const executedRules =
          await rulesEngineService.verifyTransactionForSimulation(
            transaction,
            ruleInstance,
            transaction.updatedAt ? 'UPDATE' : 'INITIAL'
          )
        if (executedRules) {
          this.executionDetails.push({ transaction, executedRules })
        }
        processedTransactionsCount += 1
        const progress = processedTransactionsCount / transactions.length
        if (
          onePercentTransactionsCount === 0 ||
          progress === 1 ||
          processedTransactionsCount % onePercentTransactionsCount === 0
        ) {
          logger.info(
            `Progress: ${progress * 100} % (${processedTransactionsCount} / ${
              transactions.length
            })`
          )
          await progressQueue.add(() => onProgressChange(progress))
        }
      },
      { concurrency: 10 }
    )
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
    ruleInstanceId: string,
    filters?: SimulationBeaconSampling['filters']
  ): Promise<number> {
    return (
      (await this.transactionRepository?.getTransactionsCountByQuery({
        'hitRules.ruleInstanceId': ruleInstanceId,
        ...(filters?.beforeTimestamp && {
          timestamp: {
            $lte: filters.beforeTimestamp,
            $gte: filters.afterTimestamp,
          },
        }),
      })) ?? 0
    )
  }

  private getSimulatedTransactionsFalsePositiveCount(
    originalFalsePositiveUsers: string[],
    executionDetails: SimulatedTransactionHit[]
  ): number {
    const falsePositiveUsers = new Set<string>()

    for (const executionDetail of executionDetails) {
      if (!executionDetail.executedRules.ruleHit) {
        continue
      }

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
      if (transaction.originUserId) {
        users.add(transaction.originUserId)
      }

      if (transaction.destinationUserId) {
        users.add(transaction.destinationUserId)
      }
    })
    return users.size
  }

  private user = memoize(
    async (
      userId: string
    ): Promise<InternalConsumerUser | InternalBusinessUser | undefined> => {
      return this.userRepository?.getMongoUser(userId, undefined, {
        projection: {
          userId: 1,
          userDetails: { name: 1 },
          type: 1,
          legalEntity: { companyGeneralDetails: { legalName: 1 } },
          drsScore: 1,
        },
      }) as Promise<InternalConsumerUser | InternalBusinessUser | undefined>
    }
  )

  private async insertSimulationResults(
    executionDetails: SimulatedTransactionHit[],
    parameters: SimulationBeaconParameters & { taskId: string },
    riskClassificationValues: RiskClassificationScore[]
  ): Promise<void> {
    const simulationTransactionResults: SimulationBeaconTransactionResult[] = []
    for (const executionDetail of executionDetails) {
      const currentTransaction = executionDetail.transaction
      const [originUser, destinationUser] = await Promise.all([
        currentTransaction.originUserId
          ? this.user(currentTransaction.originUserId)
          : Promise.resolve(undefined),
        currentTransaction.destinationUserId
          ? this.user(currentTransaction.destinationUserId)
          : Promise.resolve(undefined),
      ])

      const transactionResult: SimulationBeaconTransactionResult = {
        taskId: parameters.taskId,
        transactionId: currentTransaction.transactionId,
        hit: executionDetail.executedRules.ruleHit ? 'HIT' : 'NO_HIT',
        action: currentTransaction.status,
        type: 'BEACON_TRANSACTION',
        timestamp: currentTransaction.timestamp,
        transactionType: currentTransaction.type,
        originAmountDetails: currentTransaction.originAmountDetails,
        destinationAmountDetails: currentTransaction.destinationAmountDetails,
        originUser: originUser
          ? {
              userId: originUser.userId,
              userName: getUserName(originUser),
              userType: originUser.type,
              riskScore: originUser.drsScore?.drsScore,
              riskLevel: getRiskLevelFromScore(
                riskClassificationValues,
                originUser.drsScore?.drsScore ?? null
              ),
            }
          : undefined,
        destinationUser: destinationUser
          ? {
              userId: destinationUser.userId,
              userName: getUserName(destinationUser),
              userType: destinationUser.type,
              riskScore: destinationUser.drsScore?.drsScore,
              riskLevel: getRiskLevelFromScore(
                riskClassificationValues,
                destinationUser.drsScore?.drsScore ?? null
              ),
            }
          : undefined,
        destinationPaymentDetails: currentTransaction.destinationPaymentDetails
          ? {
              paymentMethod:
                currentTransaction.destinationPaymentDetails.method,
              paymentMethodId:
                currentTransaction.destinationPaymentMethodId ?? '',
            }
          : undefined,
        originPaymentDetails: currentTransaction.originPaymentDetails
          ? {
              paymentMethod: currentTransaction.originPaymentDetails.method,
              paymentMethodId: currentTransaction.originPaymentMethodId ?? '',
            }
          : undefined,
        riskLevel: getRiskLevelFromScore(
          riskClassificationValues,
          currentTransaction.arsScore?.arsScore ?? null
        ),
        riskScore: currentTransaction.arsScore?.arsScore,
      }
      simulationTransactionResults.push(transactionResult)
    }

    const users = await this.getSimulationUserHits(
      simulationTransactionResults,
      parameters
    )

    await this.simulationResultRepository?.saveSimulationResults(users)
    await this.simulationResultRepository?.saveSimulationResults(
      simulationTransactionResults
    )
  }

  private async getSimulationUserHits(
    transactionResults: SimulationBeaconTransactionResult[],
    parameters: SimulationBeaconParameters & { taskId: string }
  ): Promise<SimulationBeaconResultUser[]> {
    const users = new Map<string, SimulationBeaconResultUser>()
    for (const result of transactionResults) {
      const isTransactionHit = result.hit === 'HIT'
      const { originUser, destinationUser } = result

      const processUser = (
        user: typeof originUser | typeof destinationUser
      ) => {
        if (!user) {
          return
        }
        const userId = user.userId
        if (!users.has(userId)) {
          if (users.get(userId)?.hit === 'HIT' && !isTransactionHit) {
            return
          }
          users.set(userId, {
            ...user,
            hit: isTransactionHit ? 'HIT' : 'NO_HIT',
            taskId: parameters.taskId,
            type: 'BEACON_USER',
          })
        }
      }

      processUser(originUser)
      processUser(destinationUser)
    }

    return Array.from(users.values())
  }
}

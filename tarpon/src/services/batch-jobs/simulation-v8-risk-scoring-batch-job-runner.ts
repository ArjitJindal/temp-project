import { MongoClient } from 'mongodb'
import { cloneDeep, memoize } from 'lodash'
import pMap from 'p-map'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { getRiskLevelFromScore } from '@flagright/lib/utils'
import PQueue from 'p-queue'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { RiskRepository } from '../risk-scoring/repositories/risk-repository'
import { isConsumerUser } from '../rules-engine/utils/user-rule-utils'
import { TenantRepository } from '../tenants/repositories/tenant-repository'
import { SimulationTaskRepository } from '../simulation/repositories/simulation-task-repository'
import { SimulationResultRepository } from '../simulation/repositories/simulation-result-repository'
import { UserRepository } from '../users/repositories/user-repository'
import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import { RiskScoringV8Service } from '../risk-scoring/risk-scoring-v8-service'
import { BatchJobRunner } from './batch-job-runner-base'
import { traceable } from '@/core/xray'
import { SimulationRiskFactorsV8BatchJob } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { SimulationV8RiskFactorsJob } from '@/@types/openapi-internal/SimulationV8RiskFactorsJob'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { SimulationV8RiskFactorsResult } from '@/@types/openapi-internal/SimulationV8RiskFactorsResult'
import { SimulationV8RiskFactorsStatisticsResult } from '@/@types/openapi-internal/SimulationV8RiskFactorsStatisticsResult'
import { SimulationV8RiskFactorsStatistics } from '@/@types/openapi-internal/SimulationV8RiskFactorsStatistics'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { User } from '@/@types/openapi-internal/User'
import { Business } from '@/@types/openapi-internal/Business'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { FormulaCustom } from '@/@types/openapi-internal/FormulaCustom'
import { FormulaSimpleAvg } from '@/@types/openapi-internal/FormulaSimpleAvg'
import { FormulaLegacyMovingAvg } from '@/@types/openapi-internal/FormulaLegacyMovingAvg'
import { getUserName } from '@/utils/helpers'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

const MAX_USERS = 100000
const CONCURRENCY = 200
const SIMULATED_TRANSACTIONS_COUNT = 300000
const BATCH_SIZE = 2000

type SimulationRiskFactorsResultRaw = Record<
  RiskLevel,
  { current: number; simulated: number }
>
type SegregatedRiskFactors = {
  consumer: RiskFactor[]
  business: RiskFactor[]
  transactions: RiskFactor[]
}

@traceable
export class SimulationV8RiskFactorsBatchJobRunner extends BatchJobRunner {
  private tenantId!: string
  private mongoDb!: MongoClient
  private userRepository!: UserRepository
  private transactionRepo!: MongoDbTransactionRepository
  private riskScoringV8Service!: RiskScoringV8Service
  private riskRepository!: RiskRepository
  private riskFactors?: SegregatedRiskFactors
  private job?: SimulationRiskFactorsV8BatchJob
  private dynamoDb?: DynamoDBClient
  private transactionsResult?: SimulationRiskFactorsResultRaw
  private usersKrsResult?: SimulationRiskFactorsResultRaw
  private usersDrsResult?: SimulationRiskFactorsResultRaw
  private userResultsSaved: number = 0
  private usersResultArray: SimulationV8RiskFactorsResult[] = []
  private totalUsers: number = 0
  private transactionsProcessedCount = 0
  private progress: number = 0
  private usersProgressQueue = new PQueue({ concurrency: 1 })
  private transactionsProgressQueue = new PQueue({ concurrency: 1 })
  private transactionIdsProcessed = new Map<
    string,
    { current: number; simulated: number }
  >()

  protected async run(job: SimulationRiskFactorsV8BatchJob): Promise<void> {
    this.job = job
    const { tenantId, parameters } = job
    this.tenantId = tenantId
    const { taskId } = parameters
    const dynamoDb = getDynamoDbClient()
    this.mongoDb = await getMongoDbClient()
    const simulationTaskRepository = new SimulationTaskRepository(
      tenantId,
      this.mongoDb
    )
    this.dynamoDb = dynamoDb
    const currentJob =
      await simulationTaskRepository.getSimulationJob<SimulationV8RiskFactorsJob>(
        parameters.jobId
      )
    const task = currentJob?.iterations.find((i) => i.taskId === taskId)
    this.userRepository = new UserRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb,
    })
    const logicEvaluator = new LogicEvaluator(this.tenantId, dynamoDb)
    logicEvaluator.setMode('MONGODB') // As we use mongoDb for simulation
    this.riskScoringV8Service = new RiskScoringV8Service(
      this.tenantId,
      logicEvaluator,
      {
        mongoDb: this.mongoDb,
        dynamoDb: dynamoDb,
      }
    )
    this.riskFactors = this.segregateAndFilterRiskFactors(
      task?.parameters.parameters ?? []
    )
    this.transactionRepo = new MongoDbTransactionRepository(
      this.tenantId,
      this.mongoDb
    )
    this.riskRepository = new RiskRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb,
    })
    const simulationResultRepository = new SimulationResultRepository(
      tenantId,
      this.mongoDb
    )
    const allUsersCount = await this.userRepository.getEstimatedUsersCount()
    this.totalUsers = Math.min(MAX_USERS, allUsersCount)
    await simulationTaskRepository.updateTaskStatus(
      taskId,
      'IN_PROGRESS',
      0,
      this.totalUsers
    )
    try {
      const resultRaw: SimulationRiskFactorsResultRaw = {
        LOW: { current: 0, simulated: 0 },
        MEDIUM: { current: 0, simulated: 0 },
        HIGH: { current: 0, simulated: 0 },
        VERY_HIGH: { current: 0, simulated: 0 },
        VERY_LOW: { current: 0, simulated: 0 },
      }

      const transactionsResult: SimulationRiskFactorsResultRaw =
        cloneDeep(resultRaw)

      this.transactionsResult = transactionsResult

      const usersKrsResult: SimulationRiskFactorsResultRaw =
        cloneDeep(resultRaw)

      this.usersKrsResult = usersKrsResult

      const usersDrsResult: SimulationRiskFactorsResultRaw =
        cloneDeep(resultRaw)

      this.usersDrsResult = usersDrsResult

      const riskClassificationValues =
        await this.riskRepository.getRiskClassificationValues()
      const updateProgress = async (progress: number) => {
        const totalUserResults = this.usersResultArray.length
        const userResultsToSave = this.usersResultArray.slice(
          this.userResultsSaved,
          totalUserResults
        )
        this.userResultsSaved = totalUserResults
        await Promise.all([
          await simulationTaskRepository.updateTaskStatus(
            taskId,
            'IN_PROGRESS',
            progress
          ),
          await simulationResultRepository.saveSimulationResults(
            userResultsToSave
          ),
          await simulationTaskRepository.updateStatistics<SimulationV8RiskFactorsStatisticsResult>(
            taskId,
            this.getStatistics(
              this.extrapolateStats(
                this.totalUsers,
                allUsersCount,
                usersKrsResult
              ),
              this.extrapolateStats(
                this.totalUsers,
                allUsersCount,
                usersDrsResult
              ),
              this.extrapolateStats(
                SIMULATED_TRANSACTIONS_COUNT,
                SIMULATED_TRANSACTIONS_COUNT,
                this.transactionsResult ?? transactionsResult
              )
            )
          ),
        ])
      }

      if (!this.tenantId) {
        throw new Error('Tenant ID is not set')
      }
      const tenantRepository = new TenantRepository(this.tenantId, {
        mongoDb: this.mongoDb,
        dynamoDb: this.dynamoDb,
      })
      const tenantSettings = await tenantRepository.getTenantSettings()
      const { riskScoringAlgorithm } = tenantSettings
      await this.processAllUsers(
        riskClassificationValues,
        updateProgress,
        riskScoringAlgorithm
      )
      await simulationTaskRepository.updateTaskStatus(taskId, 'SUCCESS')
    } catch (e) {
      await simulationTaskRepository.updateTaskStatus(taskId, 'FAILED', 0, 0)
      throw e
    }
  }

  private async processAllUsers(
    riskClassificationValues: RiskClassificationScore[],
    updateProgress: (progress: number) => Promise<void>,
    riskScoringAlgorithm?:
      | FormulaCustom
      | FormulaSimpleAvg
      | FormulaLegacyMovingAvg
  ) {
    const usersCursor = this.userRepository
      .sampleUsersCursor(this.totalUsers)
      .addCursorFlag('noCursorTimeout', true)
    await processCursorInBatch(
      usersCursor,
      async (users) => {
        await this.processUsersBatch(
          users,
          riskClassificationValues,
          updateProgress,
          riskScoringAlgorithm
        )
      },
      {
        processBatchSize: BATCH_SIZE,
        mongoBatchSize: BATCH_SIZE,
      }
    )
  }

  private async processUsersBatch(
    users: InternalUser[],
    riskClassificationValues: RiskClassificationScore[],
    updateProgress: (progress: number) => Promise<void>,
    riskScoringAlgorithm?:
      | FormulaCustom
      | FormulaSimpleAvg
      | FormulaLegacyMovingAvg
  ) {
    await pMap(
      users ?? [],
      async (user) => {
        // processing user KRS
        const [simulatedKrs, averageArs] = await Promise.all([
          this.calculateUserKrs(user),
          this.processUserTransactions(user),
        ])

        let simulatedDrs: number | undefined
        if (
          riskScoringAlgorithm?.type !== 'FORMULA_LEGACY_MOVING_AVG' // As we do not allow CRA simulation for legacy moving average
        ) {
          simulatedDrs = this.riskScoringV8Service?.calculateNewDrsScore({
            algorithm: riskScoringAlgorithm ?? { type: 'FORMULA_SIMPLE_AVG' },
            oldDrsScore: undefined,
            krsScore: simulatedKrs,
            avgArsScore: averageArs,
            arsScore: undefined,
          })
        }
        const currentKrs = user.krsScore?.krsScore ?? 0
        const currentKrsRiskLevel = getRiskLevelFromScore(
          riskClassificationValues,
          currentKrs
        )
        const currentDrs = user.drsScore?.drsScore ?? 0
        const currentDrsRiskLevel = getRiskLevelFromScore(
          riskClassificationValues,
          currentDrs
        )
        const simulatedKrsRiskLevel = getRiskLevelFromScore(
          riskClassificationValues,
          simulatedKrs
        )
        const simulatedDrsRiskLevel = getRiskLevelFromScore(
          riskClassificationValues,
          simulatedDrs ?? 0
        )
        this.usersResultArray.push({
          userId: user.userId,
          type: 'RISK_FACTORS_V8',
          userName: getUserName(user),
          userType: user.type,
          taskId: this.job?.parameters.taskId ?? '',
          current: {
            krs: {
              riskScore: currentKrs,
              riskLevel: currentKrsRiskLevel,
            },
            drs: {
              riskScore: currentDrs,
              riskLevel: currentDrsRiskLevel,
            },
          },
          simulated: {
            krs: {
              riskScore: simulatedKrs,
              riskLevel: simulatedKrsRiskLevel,
            },
            drs: {
              riskScore: simulatedDrs,
              riskLevel: simulatedDrsRiskLevel,
            },
          },
        })
        if (this.usersKrsResult?.[simulatedKrsRiskLevel]) {
          this.usersKrsResult[simulatedKrsRiskLevel].simulated++
        }
        if (this.usersDrsResult?.[simulatedDrsRiskLevel]) {
          this.usersDrsResult[simulatedDrsRiskLevel].simulated++
        }
        if (this.usersKrsResult?.[currentKrsRiskLevel]) {
          this.usersKrsResult[currentKrsRiskLevel].current++
        }
        if (this.usersDrsResult?.[currentDrsRiskLevel]) {
          this.usersDrsResult[currentDrsRiskLevel].current++
        }
        await this.usersProgressQueue.add(async () => {
          // Saving Transactions results here to avoid double counting transactions
          const transactionData = Array.from(
            this.transactionIdsProcessed.values()
          ).slice(this.transactionsProcessedCount)
          for (const transaction of transactionData) {
            const simulatedLevel = getRiskLevelFromScore(
              riskClassificationValues,
              transaction.simulated
            )
            const currentLevel = getRiskLevelFromScore(
              riskClassificationValues,
              transaction.current
            )
            if (this.transactionsResult?.[currentLevel]) {
              this.transactionsResult[currentLevel].current++
            }
            if (this.transactionsResult?.[simulatedLevel]) {
              this.transactionsResult[simulatedLevel].simulated++
            }
          }
          this.transactionsProcessedCount += transactionData.length
          await this.updateStatusAndProgress(updateProgress)
        })
      },
      { concurrency: CONCURRENCY }
    )
  }

  private segregateAndFilterRiskFactors(
    riskFactors: RiskFactor[]
  ): SegregatedRiskFactors {
    return riskFactors.reduce(
      (acc, rf) => {
        if (rf.status !== 'ACTIVE') {
          return acc
        }
        switch (rf.type) {
          case 'CONSUMER_USER':
            acc.consumer.push(rf)
            break
          case 'BUSINESS':
            acc.business.push(rf)
            break
          case 'TRANSACTION':
            acc.transactions.push(rf)
            break
        }
        return acc
      },
      {
        consumer: [],
        business: [],
        transactions: [],
      } as {
        consumer: RiskFactor[]
        business: RiskFactor[]
        transactions: RiskFactor[]
      }
    )
  }

  private async processUserTransactionsBatch(
    transactions: InternalTransaction[],
    updateArsStats: (ars: number) => void
  ): Promise<void> {
    await pMap(
      transactions ?? [],
      async (transaction) => {
        const { originUserId, destinationUserId } = transaction
        // Processing transactions using map to avoid double counting transactions
        let score = 0
        if (!this.transactionIdsProcessed.has(transaction.transactionId)) {
          const senderUser = await this.userLoader(originUserId)
          const receiverUser = await this.userLoader(destinationUserId)
          const result =
            await this.riskScoringV8Service?.calculateRiskFactorsScore(
              {
                transaction,
                type: 'TRANSACTION',
                transactionEvents: [],
                senderUser,
                receiverUser,
              },
              this.riskFactors?.transactions ?? []
            )
          score = result?.riskFactorsResult.score
          this.transactionIdsProcessed.set(transaction.transactionId, {
            current: transaction.arsScore?.arsScore ?? 0,
            simulated: score ?? 0,
          })
        } else {
          score =
            this.transactionIdsProcessed.get(transaction.transactionId)
              ?.simulated ?? 0
        }
        await this.transactionsProgressQueue.add(() => {
          updateArsStats(score ?? 0)
        })
      },
      { concurrency: CONCURRENCY }
    )
  }

  private async processUserTransactions(
    user: User | Business
  ): Promise<number> {
    const transactionsCursor = this.transactionRepo
      .getTransactionsCursor({
        filterUserId: user.userId,
      })
      .addCursorFlag('noCursorTimeout', true)
    let totalArs = 0,
      transactionsCount = 0
    const updateArsStats = (ars: number) => {
      totalArs += ars
      transactionsCount++
    }

    await processCursorInBatch(
      transactionsCursor,
      async (transactions) => {
        await this.processUserTransactionsBatch(transactions, updateArsStats)
      },
      { processBatchSize: BATCH_SIZE, mongoBatchSize: BATCH_SIZE }
    )
    return totalArs / (transactionsCount == 0 ? 1 : transactionsCount)
  }

  private async calculateUserKrs(user: User | Business): Promise<number> {
    const isConsumer = isConsumerUser(user)
    const riskFactors = isConsumer
      ? this.riskFactors?.consumer
      : this.riskFactors?.business
    if (!riskFactors) {
      return 0
    }
    const result = await this.riskScoringV8Service.calculateRiskFactorsScore(
      {
        user,
        type: 'USER',
      },
      riskFactors
    )
    return result?.riskFactorsResult.score ?? 0
  }

  private extrapolateStats(
    currentCount: number,
    actualCount: number,
    stats: SimulationRiskFactorsResultRaw
  ) {
    if (currentCount === actualCount) {
      return stats
    }

    const ratio = actualCount / currentCount

    const extrapolatedStats = Object.entries(stats).reduce(
      (acc, [riskLevel, { current, simulated }]) => {
        acc[riskLevel as RiskLevel] = {
          current: Math.round(current * ratio),
          simulated: Math.round(simulated * ratio),
        }
        return acc
      },
      {} as SimulationRiskFactorsResultRaw
    )

    return extrapolatedStats
  }

  private getStatistics(
    usersKrsResult: SimulationRiskFactorsResultRaw,
    usersDrsResult: SimulationRiskFactorsResultRaw,
    transactionsResult: SimulationRiskFactorsResultRaw
  ): SimulationV8RiskFactorsStatisticsResult {
    const usersCurrent: SimulationV8RiskFactorsStatistics[] = Object.entries(
      usersKrsResult
    ).map(([riskLevel, { current }]) => ({
      count: current,
      riskLevel: riskLevel as RiskLevel,
      riskType: 'KRS',
    }))

    const usersSimulated: SimulationV8RiskFactorsStatistics[] = Object.entries(
      usersKrsResult
    ).map(([riskLevel, { simulated }]) => ({
      count: simulated,
      riskLevel: riskLevel as RiskLevel,
      riskType: 'KRS',
    }))

    const usersDrsCurrent: SimulationV8RiskFactorsStatistics[] = Object.entries(
      usersDrsResult
    ).map(([riskLevel, { current }]) => ({
      count: current,
      riskLevel: riskLevel as RiskLevel,
      riskType: 'DRS',
    }))

    const usersDrsSimulated: SimulationV8RiskFactorsStatistics[] =
      Object.entries(usersDrsResult).map(([riskLevel, { simulated }]) => ({
        count: simulated,
        riskLevel: riskLevel as RiskLevel,
        riskType: 'DRS',
      }))

    const transactionsCurrent: SimulationV8RiskFactorsStatistics[] =
      Object.entries(transactionsResult).map(([riskLevel, { current }]) => ({
        count: current,
        riskLevel: riskLevel as RiskLevel,
        riskType: 'ARS',
      }))

    const transactionsSimulated: SimulationV8RiskFactorsStatistics[] =
      Object.entries(transactionsResult).map(([riskLevel, { simulated }]) => ({
        count: simulated,
        riskLevel: riskLevel as RiskLevel,
        riskType: 'ARS',
      }))

    return {
      current: usersCurrent.concat(usersDrsCurrent).concat(transactionsCurrent),
      simulated: usersSimulated
        .concat(usersDrsSimulated)
        .concat(transactionsSimulated),
    }
  }

  protected async updateStatusAndProgress(
    updateProgress: (progress: number) => Promise<void>
  ): Promise<void> {
    this.progress++
    const onePercentEntities = Math.floor(this.totalUsers * 0.01)
    const progress = this.progress / this.totalUsers
    if (
      onePercentEntities === 0 ||
      progress === 1 ||
      this.progress % onePercentEntities === 0
    ) {
      await updateProgress(progress)
    }
  }

  private userLoader = memoize(
    async (userId: string | undefined): Promise<InternalUser | undefined> => {
      if (!userId) {
        return undefined
      }
      if (!this.tenantId) {
        throw new Error('Tenant ID is not set')
      }
      const userRepository = new UserRepository(this.tenantId, {
        dynamoDb: this.dynamoDb,
        mongoDb: this.mongoDb,
      })
      const user = await userRepository.getMongoUser(userId)
      return user ?? undefined
    },
    (userId: string | undefined) => userId ?? ''
  )
}

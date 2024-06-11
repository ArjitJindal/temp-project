import pMap from 'p-map'
import { cloneDeep } from 'lodash'
import { MongoClient } from 'mongodb'
import { getRiskLevelFromScore } from '@flagright/lib/utils'
import { RiskScoringService } from '../risk-scoring'
import { RiskRepository } from '../risk-scoring/repositories/risk-repository'
import { UserRepository } from '../users/repositories/user-repository'
import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import { SimulationResultRepository } from '../simulation/repositories/simulation-result-repository'
import { SimulationTaskRepository } from '../simulation/repositories/simulation-task-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { SimulationRiskFactorsBatchJob } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { SimulationRiskFactorsResult } from '@/@types/openapi-internal/SimulationRiskFactorsResult'
import { getUserName } from '@/utils/helpers'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { SimulationRiskFactorsStatisticsResult } from '@/@types/openapi-internal/SimulationRiskFactorsStatisticsResult'
import { SimulationRiskFactorsStatistics } from '@/@types/openapi-internal/SimulationRiskFactorsStatistics'
import { logger } from '@/core/logger'
import { traceable } from '@/core/xray'
import { ParameterAttributeRiskValues } from '@/@types/openapi-internal/ParameterAttributeRiskValues'

const SAMPLE_USERS_COUNT = 10_000
const SAMPLE_TRANSACTIONS_COUNT = 10_000
const CONCURRENCY = 10
type SimulationRiskFactorsResultRaw = Record<
  RiskLevel,
  { current: number; simulated: number }
>

@traceable
export class SimulationRiskFactorsBatchJobRunner extends BatchJobRunner {
  riskScoringService?: RiskScoringService
  tenantId?: string
  mongoDb?: MongoClient
  userRepository?: UserRepository
  job?: SimulationRiskFactorsBatchJob
  transactionRepo?: MongoDbTransactionRepository
  progress: number = 0
  transactionsResult?: SimulationRiskFactorsResultRaw
  usersResult?: SimulationRiskFactorsResultRaw
  parameterAttributeRiskValues?: ParameterAttributeRiskValues[]

  protected async run(job: SimulationRiskFactorsBatchJob): Promise<void> {
    const { parameters, tenantId } = job
    this.tenantId = tenantId
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
    this.mongoDb = mongoDb
    const simulationTaskRepository = new SimulationTaskRepository(
      tenantId,
      mongoDb
    )
    const currentJob = await simulationTaskRepository.getSimulationJob(
      parameters.jobId
    )
    const task = currentJob?.iterations.find(
      (i) => i.taskId === parameters.taskId
    )
    this.parameterAttributeRiskValues =
      task?.parameters?.parameterAttributeRiskValues
    const riskRepository = new RiskRepository(tenantId, { dynamoDb, mongoDb })
    this.userRepository = new UserRepository(tenantId, { mongoDb, dynamoDb })
    this.job = job
    this.riskScoringService = new RiskScoringService(tenantId, {
      dynamoDb,
      mongoDb,
    })

    this.transactionRepo = new MongoDbTransactionRepository(
      this.tenantId,
      this.mongoDb
    )

    const simulationResultRepository = new SimulationResultRepository(
      tenantId,
      mongoDb
    )

    await simulationTaskRepository.updateTaskStatus(
      parameters.taskId,
      'IN_PROGRESS'
    )

    let interval: NodeJS.Timeout | undefined

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

      const allTransactionsCount =
        await this.transactionRepo.getAllTransactionsCount()

      const transactionsCount = Math.min(
        allTransactionsCount,
        SAMPLE_TRANSACTIONS_COUNT
      )

      const allUsersCount = await this.userRepository.getUsersCount()

      const usersCount =
        job.parameters.sampling.usersCount === 'ALL'
          ? allUsersCount
          : Math.min(allUsersCount, SAMPLE_USERS_COUNT)

      const totalEntities = transactionsCount + usersCount

      const usersResult: SimulationRiskFactorsResultRaw = cloneDeep(resultRaw)

      this.usersResult = usersResult

      const riskClassificationValues =
        await riskRepository.getRiskClassificationValues()

      interval = setInterval(async () => {
        await simulationTaskRepository.updateTaskStatus(
          parameters.taskId,
          'IN_PROGRESS',
          this.progress / totalEntities
        )
      }, 10000)

      const usersResultArray = await this.processAllUsers(
        riskClassificationValues
      )

      await this.processAllTransactions(riskClassificationValues)

      await simulationResultRepository.saveSimulationResults(usersResultArray)
      await simulationTaskRepository.updateStatistics<SimulationRiskFactorsStatisticsResult>(
        this.job?.parameters.taskId,
        this.getStatistics(
          this.extrapolateStats(usersCount, allUsersCount, usersResult),
          this.extrapolateStats(
            transactionsCount,
            allTransactionsCount,
            transactionsResult
          )
        )
      )
      await simulationTaskRepository.updateTaskStatus(
        parameters.taskId,
        'SUCCESS',
        1
      )
    } catch (error) {
      logger.error('Error in SimulationRiskFactorsBatchJobRunner', error)
      await simulationTaskRepository.updateTaskStatus(
        parameters.taskId,
        'FAILED',
        0
      )
      throw error
    } finally {
      if (interval) {
        clearInterval(interval)
      }
    }
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
    usersResult: SimulationRiskFactorsResultRaw,
    transactionsResult: SimulationRiskFactorsResultRaw
  ): SimulationRiskFactorsStatisticsResult {
    const usersCurrent: SimulationRiskFactorsStatistics[] = Object.entries(
      usersResult
    ).map(([riskLevel, { current }]) => ({
      count: current,
      riskLevel: riskLevel as RiskLevel,
      riskType: 'KRS',
    }))

    const usersSimulated: SimulationRiskFactorsStatistics[] = Object.entries(
      usersResult
    ).map(([riskLevel, { simulated }]) => ({
      count: simulated,
      riskLevel: riskLevel as RiskLevel,
      riskType: 'KRS',
    }))

    const transactionsCurrent: SimulationRiskFactorsStatistics[] =
      Object.entries(transactionsResult).map(([riskLevel, { current }]) => ({
        count: current,
        riskLevel: riskLevel as RiskLevel,
        riskType: 'ARS',
      }))

    const transactionsSimulated: SimulationRiskFactorsStatistics[] =
      Object.entries(transactionsResult).map(([riskLevel, { simulated }]) => ({
        count: simulated,
        riskLevel: riskLevel as RiskLevel,
        riskType: 'ARS',
      }))

    return {
      current: usersCurrent.concat(transactionsCurrent),
      simulated: usersSimulated.concat(transactionsSimulated),
    }
  }

  private async processAllUsers(
    riskClassificationValues: RiskClassificationScore[]
  ): Promise<SimulationRiskFactorsResult[]> {
    const sampling = this.job?.parameters.sampling.usersCount || 'RANDOM'
    const usersCursor =
      sampling === 'ALL'
        ? this.userRepository?.getAllUsersCursor()
        : this.userRepository?.sampleUsersCursor(SAMPLE_USERS_COUNT)

    const usersResultArray: SimulationRiskFactorsResult[] = []
    if (!usersCursor) {
      throw new Error('usersCursor is undefined')
    }
    await processCursorInBatch<InternalUser>(
      usersCursor,
      async (usersChunk) => {
        const data = await this.processUsers(
          usersChunk,
          riskClassificationValues
        )

        usersResultArray.push(...data)
      },
      { mongoBatchSize: 100, processBatchSize: 10 }
    )

    return usersResultArray
  }

  private async processAllTransactions(
    riskClassificationValues: RiskClassificationScore[]
  ): Promise<void> {
    const transactionsCursor = this.transactionRepo?.sampleTransactionsCursor(
      SAMPLE_TRANSACTIONS_COUNT
    )

    let transactions: InternalTransaction[] = []
    if (!transactionsCursor) {
      throw new Error('transactionsCursor is undefined')
    }
    await processCursorInBatch<InternalTransaction>(
      transactionsCursor,
      async (transactionsChunk) => {
        await this.processTransactions(
          transactionsChunk,
          riskClassificationValues
        )
      },
      { mongoBatchSize: 100, processBatchSize: 10 }
    )
    for await (const transaction of transactionsCursor) {
      transactions.push(transaction)

      if (transactions.length === CONCURRENCY) {
        await this.processTransactions(transactions, riskClassificationValues)
        transactions = []
      }
    }

    if (transactions.length > 0) {
      await this.processTransactions(transactions, riskClassificationValues)
    }
  }

  private async processTransactions(
    transactions: InternalTransaction[],
    riskClassificationValues: RiskClassificationScore[]
  ): Promise<void> {
    await pMap(
      transactions,
      async (transaction) => {
        const recaluclatedData =
          await this.riskScoringService?.calculateArsScore(
            transaction,
            riskClassificationValues,
            this.parameterAttributeRiskValues ?? []
          )

        const riskLevel = getRiskLevelFromScore(
          riskClassificationValues,
          recaluclatedData?.score ?? null
        )

        const currentRiskLevel = getRiskLevelFromScore(
          riskClassificationValues,
          transaction.arsScore?.arsScore ?? null
        )

        const simulatedRiskLevel = riskLevel

        if (this.transactionsResult?.[currentRiskLevel]) {
          this.transactionsResult[currentRiskLevel].current++
        }
        if (this.transactionsResult?.[simulatedRiskLevel]) {
          this.transactionsResult[simulatedRiskLevel].simulated++
        }
        this.progress++
      },
      { concurrency: CONCURRENCY }
    )
  }

  private async processUsers(
    users: InternalUser[],
    riskClassificationValues: RiskClassificationScore[]
  ): Promise<SimulationRiskFactorsResult[]> {
    const userRiskScores = await pMap<
      InternalUser,
      SimulationRiskFactorsResult
    >(
      users,
      async (user) => {
        this.progress++
        return await this.recalculateUserRiskScores(
          user,
          riskClassificationValues
        )
      },
      { concurrency: CONCURRENCY }
    )

    return userRiskScores
  }

  private async recalculateUserRiskScores(
    user: InternalUser,
    riskClassificationValues: RiskClassificationScore[]
  ): Promise<SimulationRiskFactorsResult> {
    const recaluclatedData = await this.riskScoringService?.calculateKrsScore(
      user,
      riskClassificationValues,
      this.parameterAttributeRiskValues ?? []
    )

    const simulatedRiskLevel = getRiskLevelFromScore(
      riskClassificationValues,
      recaluclatedData?.score ?? 0
    )

    const currentRiskLevel = getRiskLevelFromScore(
      riskClassificationValues,
      user.krsScore?.krsScore ?? null
    )

    if (this.usersResult?.[currentRiskLevel]) {
      this.usersResult[currentRiskLevel].current++
    }
    if (this.usersResult?.[simulatedRiskLevel]) {
      this.usersResult[simulatedRiskLevel].simulated++
    }

    return {
      taskId: this.job?.parameters.taskId ?? '',
      type: 'RISK_FACTORS',
      userId: user.userId,
      userName: getUserName(user),
      userType: user.type,
      current: {
        krs: {
          riskScore: user.krsScore?.krsScore,
          riskLevel: currentRiskLevel,
        },
      },
      simulated: {
        krs: {
          riskScore: recaluclatedData?.score,
          riskLevel: simulatedRiskLevel,
        },
      },
    }
  }
}

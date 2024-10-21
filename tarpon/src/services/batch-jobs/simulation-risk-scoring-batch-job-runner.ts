import pMap from 'p-map'
import { cloneDeep } from 'lodash'
import { MongoClient } from 'mongodb'
import { getRiskLevelFromScore } from '@flagright/lib/utils'
import PQueue from 'p-queue'
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
import { SimulationRiskFactorsJob } from '@/@types/openapi-internal/SimulationRiskFactorsJob'

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
  userResultsSaved: number = 0
  usersResultArray: SimulationRiskFactorsResult[] = []
  totalEntities: number = 0
  progressQueue = new PQueue({ concurrency: 1 })

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
    const currentJob =
      await simulationTaskRepository.getSimulationJob<SimulationRiskFactorsJob>(
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

    this.totalEntities = transactionsCount + usersCount

    await simulationTaskRepository.updateTaskStatus(
      parameters.taskId,
      'IN_PROGRESS',
      0,
      this.totalEntities
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

      const usersResult: SimulationRiskFactorsResultRaw = cloneDeep(resultRaw)

      this.usersResult = usersResult
      const riskClassificationValues =
        await riskRepository.getRiskClassificationValues()
      const taskId = this.job?.parameters.taskId
      const updateProgress = async (progress: number) => {
        const totalUserResults = this.usersResultArray.length
        const userResultsToSave = this.usersResultArray.slice(
          this.userResultsSaved,
          totalUserResults
        )
        this.userResultsSaved = totalUserResults
        await Promise.all([
          await simulationTaskRepository.updateTaskStatus(
            parameters.taskId,
            'IN_PROGRESS',
            progress
          ),
          simulationResultRepository.saveSimulationResults(userResultsToSave),
          simulationTaskRepository.updateStatistics<SimulationRiskFactorsStatisticsResult>(
            taskId,
            this.getStatistics(
              this.extrapolateStats(usersCount, allUsersCount, usersResult),
              this.extrapolateStats(
                transactionsCount,
                allTransactionsCount,
                this.transactionsResult ?? transactionsResult
              )
            )
          ),
        ])
      }

      await this.processAllUsers(riskClassificationValues, updateProgress)

      await this.processAllTransactions(
        riskClassificationValues,
        updateProgress
      )
      await simulationTaskRepository.updateTaskStatus(
        parameters.taskId,
        'SUCCESS'
      )
    } catch (error) {
      logger.error('Error in SimulationRiskFactorsBatchJobRunner', error)
      await simulationTaskRepository.updateTaskStatus(
        parameters.taskId,
        'FAILED',
        0
      )
      throw error
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
    riskClassificationValues: RiskClassificationScore[],
    updateProgress: (progress: number) => Promise<void>
  ) {
    const sampling = this.job?.parameters.sampling.usersCount || 'RANDOM'
    const usersCursor =
      sampling === 'ALL'
        ? this.userRepository?.getAllUsersCursor()
        : this.userRepository?.sampleUsersCursor(SAMPLE_USERS_COUNT)

    if (!usersCursor) {
      throw new Error('usersCursor is undefined')
    }
    await processCursorInBatch<InternalUser>(
      usersCursor,
      async (usersChunk) => {
        await this.processUsers(
          usersChunk,
          riskClassificationValues,
          updateProgress
        )
      },
      { mongoBatchSize: 100, processBatchSize: 10 }
    )
  }

  private async processAllTransactions(
    riskClassificationValues: RiskClassificationScore[],
    updateProgress: (progress: number) => Promise<void>
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
          riskClassificationValues,
          updateProgress
        )
      },
      { mongoBatchSize: 100, processBatchSize: 10 }
    )
    for await (const transaction of transactionsCursor) {
      transactions.push(transaction)

      if (transactions.length === CONCURRENCY) {
        await this.processTransactions(
          transactions,
          riskClassificationValues,
          updateProgress
        )
        transactions = []
      }
    }

    if (transactions.length > 0) {
      await this.processTransactions(
        transactions,
        riskClassificationValues,
        updateProgress
      )
    }
  }

  private async processTransactions(
    transactions: InternalTransaction[],
    riskClassificationValues: RiskClassificationScore[],
    updateProgress: (progress: number) => Promise<void>
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

        await this.progressQueue.add(() =>
          this.updateStatusAndProgress(updateProgress)
        )
      },
      { concurrency: CONCURRENCY }
    )
  }

  private async processUsers(
    users: InternalUser[],
    riskClassificationValues: RiskClassificationScore[],
    updateProgress: (progress: number) => Promise<void>
  ) {
    await pMap(
      users,
      async (user) => {
        const result = await this.recalculateUserRiskScores(
          user,
          riskClassificationValues
        )
        this.usersResultArray.push(result)
        await this.progressQueue.add(() =>
          this.updateStatusAndProgress(updateProgress)
        )
      },
      { concurrency: CONCURRENCY }
    )
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

  protected async updateStatusAndProgress(
    updateProgress: (progress: number) => Promise<void>
  ): Promise<void> {
    this.progress++
    const onePercentEntities = Math.floor(this.totalEntities * 0.01)
    const progress = this.progress / this.totalEntities
    if (
      onePercentEntities === 0 ||
      progress === 1 ||
      this.progress % onePercentEntities === 0
    ) {
      await updateProgress(progress)
    }
  }
}

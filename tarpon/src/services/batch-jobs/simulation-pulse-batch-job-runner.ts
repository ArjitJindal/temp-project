import { countBy, isEmpty } from 'lodash'
import { getRiskLevelFromScore } from '@flagright/lib/utils'
import pMap from 'p-map'
import PQueue from 'p-queue'
import { BatchJobRunner } from './batch-job-runner-base'
import { SimulationRiskLevelsBatchJob } from '@/@types/batch-job'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { SimulationRiskLevelsSampling } from '@/@types/openapi-internal/SimulationRiskLevelsSampling'
import { SimulationRiskLevelsResult } from '@/@types/openapi-internal/SimulationRiskLevelsResult'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { SimulationRiskLevelsStatisticsResult } from '@/@types/openapi-internal/SimulationRiskLevelsStatisticsResult'
import { RiskScoringService } from '@/services/risk-scoring'
import { ParameterAttributeRiskValues } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { getUserName } from '@/utils/helpers'
import { traceable } from '@/core/xray'
import { SimulationTaskRepository } from '@/services/simulation/repositories/simulation-task-repository'
import { SimulationResultRepository } from '@/services/simulation/repositories/simulation-result-repository'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'

type SimulationResult = {
  userResults: Array<Omit<SimulationRiskLevelsResult, 'taskId' | 'type'>>
  transactionResults: {
    current: RiskLevel[]
    simulated: RiskLevel[]
  }
}

@traceable
export class SimulationRiskLevelsBatchJobRunner extends BatchJobRunner {
  usersRepository?: UserRepository
  riskRepository?: RiskRepository
  transactionRepository?: MongoDbTransactionRepository
  riskScoringService?: RiskScoringService
  usersSimulated: number = 0
  userResultsSaved: number = 0
  simulationResult: SimulationResult = {
    userResults: [],
    transactionResults: {
      current: [],
      simulated: [],
    },
  }
  progressQueue = new PQueue({ concurrency: 1 })

  protected async run(job: SimulationRiskLevelsBatchJob): Promise<void> {
    const { tenantId, parameters, awsCredentials } = job
    const dynamoDb = getDynamoDbClient(awsCredentials)
    const mongoDb = await getMongoDbClient()
    this.usersRepository = new UserRepository(tenantId, { mongoDb, dynamoDb })
    this.transactionRepository = new MongoDbTransactionRepository(
      tenantId,
      mongoDb,
      dynamoDb
    )
    this.riskRepository = new RiskRepository(tenantId, { dynamoDb })
    this.riskScoringService = new RiskScoringService(tenantId, {
      mongoDb,
    })

    const simulationTaskRepository = new SimulationTaskRepository(
      tenantId,
      mongoDb
    )
    const simulationResultRepository = new SimulationResultRepository(
      tenantId,
      mongoDb
    )

    const users = await this.usersRepository?.getMongoAllUsers({
      pageSize: parameters.sampling?.usersCount ?? Number.MAX_SAFE_INTEGER,
    })
    const totalUsers = users?.total ?? 0
    await simulationTaskRepository.updateTaskStatus(
      parameters.taskId,
      'IN_PROGRESS',
      0,
      totalUsers
    )

    try {
      const updateProgress = async (progress: number) => {
        const totalUserResults = this.simulationResult.userResults.length
        const userResultsToSave = this.simulationResult.userResults
          .slice(this.userResultsSaved, totalUserResults)
          .map((userResult) => ({
            taskId: parameters.taskId,
            type: 'PULSE',
            ...userResult,
          }))
        this.userResultsSaved = totalUserResults
        await Promise.all([
          simulationTaskRepository.updateTaskStatus(
            parameters.taskId,
            'IN_PROGRESS',
            progress
          ),
          simulationResultRepository.saveSimulationResults(
            userResultsToSave as SimulationRiskLevelsResult[]
          ),
          simulationTaskRepository.updateStatistics<SimulationRiskLevelsStatisticsResult>(
            parameters.taskId,
            this.getStatistics(this.simulationResult)
          ),
        ])
      }
      if (
        parameters.parameterAttributeRiskValues &&
        !isEmpty(parameters.parameterAttributeRiskValues)
      ) {
        await this.recalculateRiskScores(
          parameters.classificationValues,
          parameters.parameterAttributeRiskValues,
          users?.data ?? [],
          updateProgress,
          parameters.sampling
        )
      } else if (
        parameters.classificationValues &&
        !isEmpty(parameters.classificationValues)
      ) {
        await this.mapNewRiskLevels(
          parameters.classificationValues,
          users?.data ?? [],
          updateProgress,
          parameters.sampling
        )
      }
      await simulationTaskRepository.updateTaskStatus(
        parameters.taskId,
        'SUCCESS'
      )
    } catch (e) {
      await simulationTaskRepository.updateTaskStatus(
        parameters.taskId,
        'FAILED'
      )
      throw e
    }
  }

  private getRiskTypeStatistics(
    riskType: 'KRS' | 'ARS' | 'DRS',
    riskLevels: RiskLevel[]
  ) {
    return Object.entries(countBy(riskLevels)).map((entry) => ({
      count: entry[1],
      riskType,
      riskLevel: entry[0] as RiskLevel,
    }))
  }

  private getStatistics(
    results: SimulationResult
  ): SimulationRiskLevelsStatisticsResult {
    const currentKrsCount = this.getRiskTypeStatistics(
      'KRS',
      results.userResults
        .map((userResult) => userResult.current?.krs?.riskLevel)
        .filter(Boolean) as RiskLevel[]
    )
    const currentDrsCount = this.getRiskTypeStatistics(
      'DRS',
      results.userResults
        .map((userResult) => userResult.current?.drs?.riskLevel)
        .filter(Boolean) as RiskLevel[]
    )
    const currentArsCount = this.getRiskTypeStatistics(
      'ARS',
      results.transactionResults.current
    )
    const simulatedKrsCount = this.getRiskTypeStatistics(
      'KRS',
      results.userResults
        .map((userResult) => userResult.simulated?.krs?.riskLevel)
        .filter(Boolean) as RiskLevel[]
    )
    const simulatedDrsCount = this.getRiskTypeStatistics(
      'DRS',
      results.userResults
        .map((userResult) => userResult.simulated?.drs?.riskLevel)
        .filter(Boolean) as RiskLevel[]
    )
    const simulatedtArsCount = this.getRiskTypeStatistics(
      'ARS',
      results.transactionResults.simulated
    )
    return {
      current: currentKrsCount.concat(currentDrsCount).concat(currentArsCount),
      simulated: simulatedKrsCount
        .concat(simulatedDrsCount)
        .concat(simulatedtArsCount),
    }
  }

  private async mapNewRiskLevels(
    newClassificationValues: RiskClassificationScore[],
    users: (InternalBusinessUser | InternalConsumerUser)[],
    updateProgress: (progress: number) => Promise<void>,
    sampling?: SimulationRiskLevelsSampling
  ) {
    const currentClassificationValues =
      (await this.riskRepository?.getRiskClassificationValues()) ?? []
    const totalUsers = users.length
    await pMap(
      users,
      async (user) => {
        const userTransactions = await this.getUserTransactions(
          user.userId,
          sampling
        )
        const currentTransactionRiskLevels = userTransactions
          ?.map(
            (transaction) =>
              transaction.arsScore?.arsScore &&
              getRiskLevelFromScore(
                currentClassificationValues,
                transaction.arsScore.arsScore
              )
          )
          .filter(Boolean) as RiskLevel[]
        const simulatedTransactionRiskLevels = userTransactions
          ?.map(
            (transaction) =>
              transaction.arsScore?.arsScore &&
              getRiskLevelFromScore(
                newClassificationValues,
                transaction.arsScore.arsScore
              )
          )
          .filter(Boolean) as RiskLevel[]
        this.simulationResult.transactionResults.current.push(
          ...currentTransactionRiskLevels
        )
        this.simulationResult.transactionResults.simulated.push(
          ...simulatedTransactionRiskLevels
        )

        this.simulationResult.userResults.push({
          userId: user.userId,
          userType: user.type,
          userName: getUserName(user),
          current: {
            krs: user.krsScore && {
              riskScore: user.krsScore?.krsScore,
              riskLevel: getRiskLevelFromScore(
                currentClassificationValues,
                user.krsScore.krsScore
              ),
            },
            drs: user.drsScore && {
              riskScore: user.drsScore?.drsScore,
              riskLevel: getRiskLevelFromScore(
                currentClassificationValues,
                user.drsScore.drsScore
              ),
            },
          },
          simulated: {
            krs: user.krsScore && {
              riskScore: user.krsScore?.krsScore,
              riskLevel: getRiskLevelFromScore(
                newClassificationValues,
                user.krsScore.krsScore
              ),
            },
            drs: user.drsScore && {
              riskScore: user.drsScore?.drsScore,
              riskLevel: getRiskLevelFromScore(
                newClassificationValues,
                user.drsScore.drsScore
              ),
            },
          },
        })
        await this.progressQueue.add(() =>
          this.updateStatusAndProgress(totalUsers, updateProgress)
        )
      },
      {
        concurrency: 10,
      }
    )
  }

  private async recalculateRiskScores(
    classificationValues: RiskClassificationScore[] | undefined,
    parameterAttributeRiskValues: ParameterAttributeRiskValues[],
    users: (InternalBusinessUser | InternalConsumerUser)[],
    updateProgress: (progress: number) => Promise<void>,
    sampling?: SimulationRiskLevelsSampling
  ) {
    const currentClassificationValues =
      (await this.riskRepository?.getRiskClassificationValues()) ?? []
    const newClassificationValues = isEmpty(classificationValues)
      ? currentClassificationValues
      : (classificationValues as RiskClassificationScore[])

    await pMap(
      users,
      async (user) => {
        const { score: userKrsScore } =
          (await this.riskScoringService?.calculateKrsScore(
            user,
            newClassificationValues,
            parameterAttributeRiskValues
          )) ?? { score: 0 }
        const userTransactions = await this.getUserTransactions(
          user.userId,
          sampling
        )
        let userCurrentDrsScore = userKrsScore

        for (const transaction of userTransactions ?? []) {
          const { score: arsScore } =
            (await this.riskScoringService?.simulateArsScore(
              transaction,
              newClassificationValues,
              parameterAttributeRiskValues
            )) ?? { score: 0 }
          userCurrentDrsScore =
            this.riskScoringService?.calculateDrsScore(
              userCurrentDrsScore,
              arsScore
            ) ?? 0
          if (transaction.arsScore?.arsScore) {
            this.simulationResult.transactionResults.current.push(
              getRiskLevelFromScore(
                currentClassificationValues,
                transaction.arsScore.arsScore
              )
            )
            this.simulationResult.transactionResults.simulated.push(
              getRiskLevelFromScore(newClassificationValues, arsScore)
            )
          }
        }
        this.simulationResult.userResults.push({
          userId: user.userId,
          userType: user.type,
          userName: getUserName(user),
          current: {
            krs: user.krsScore && {
              riskScore: user.krsScore?.krsScore,
              riskLevel: getRiskLevelFromScore(
                currentClassificationValues,
                user.krsScore.krsScore
              ),
            },
            drs: user.drsScore && {
              riskScore: user.drsScore?.drsScore,
              riskLevel: getRiskLevelFromScore(
                currentClassificationValues,
                user.drsScore.drsScore
              ),
            },
          },
          simulated: {
            krs: user.krsScore && {
              riskScore: userKrsScore,
              riskLevel: getRiskLevelFromScore(
                newClassificationValues,
                userKrsScore
              ),
            },
            drs: user.drsScore && {
              riskScore: userCurrentDrsScore,
              riskLevel: getRiskLevelFromScore(
                newClassificationValues,
                userCurrentDrsScore
              ),
            },
          },
        })
        await this.progressQueue.add(() =>
          this.updateStatusAndProgress(users.length, updateProgress)
        )
      },
      { concurrency: 10 }
    )
  }

  private async getUserTransactions(
    userId: string,
    sampling?: SimulationRiskLevelsSampling
  ) {
    const userTransactions = (
      await this.transactionRepository?.getTransactions({
        pageSize:
          sampling?.userLatestTransactionsCount || Number.MAX_SAFE_INTEGER,
        filterUserId: userId,
        sortField: 'timestamp',
        sortOrder: 'descend',
      })
    )?.data
    return userTransactions
  }
  protected async updateStatusAndProgress(
    totalUsers: number,
    updateProgress: (progress: number) => Promise<void>
  ): Promise<void> {
    const onePercent = Math.floor(totalUsers / 100)
    this.usersSimulated++
    const progress = this.usersSimulated / totalUsers
    if (
      onePercent === 0 ||
      progress === 1 ||
      this.usersSimulated % onePercent === 0
    ) {
      await updateProgress(progress)
    }
  }
}

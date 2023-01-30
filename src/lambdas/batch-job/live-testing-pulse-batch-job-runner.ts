import _ from 'lodash'
import { LiveTestingTaskRepository } from '../console-api-live-testing/repositories/live-testing-task-repository'
import { LiveTestingResultRepository } from '../console-api-live-testing/repositories/live-testing-result-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { LiveTestingPulseBatchJob } from '@/@types/batch-job'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getRiskLevelFromScore } from '@/services/risk-scoring/utils'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { LiveTestPulseSampling } from '@/@types/openapi-internal/LiveTestPulseSampling'
import { LiveTestPulseResult } from '@/@types/openapi-internal/LiveTestPulseResult'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { LiveTestPulseStatisticsResult } from '@/@types/openapi-internal/LiveTestPulseStatisticsResult'
import { RiskScoringService } from '@/services/risk-scoring'
import { ParameterAttributeRiskValues } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'

type SimulationResult = {
  userResults: Array<Omit<LiveTestPulseResult, 'taskId' | 'type'>>
  transactionResults: {
    current: RiskLevel[]
    simulated: RiskLevel[]
  }
}

export class LiveTestingPulseBatchJobRunner extends BatchJobRunner {
  usersRepository?: UserRepository
  riskRepository?: RiskRepository
  transactionRepository?: TransactionRepository
  riskScoringService?: RiskScoringService

  public async run(job: LiveTestingPulseBatchJob) {
    const { tenantId, parameters, awsCredentials } = job
    const dynamoDb = getDynamoDbClient(awsCredentials)
    const mongoDb = await getMongoDbClient()
    this.usersRepository = new UserRepository(tenantId, { mongoDb })
    this.transactionRepository = new TransactionRepository(tenantId, {
      mongoDb,
    })
    this.riskRepository = new RiskRepository(tenantId, { dynamoDb })
    this.riskScoringService = new RiskScoringService(tenantId, {
      mongoDb,
    })

    const liveTestingTaskRepository = new LiveTestingTaskRepository(
      tenantId,
      mongoDb
    )
    const liveTestingResultRepository = new LiveTestingResultRepository(
      tenantId,
      mongoDb
    )
    await liveTestingTaskRepository.updateTaskStatus(
      parameters.taskId,
      'IN_PROGRESS'
    )

    try {
      let results: SimulationResult | undefined
      if (
        parameters.parameterAttributeRiskValues &&
        !_.isEmpty(parameters.parameterAttributeRiskValues)
      ) {
        results = await this.recalculateRiskScores(
          parameters.classificationValues,
          parameters.parameterAttributeRiskValues,
          parameters.sampling
        )
      } else if (
        parameters.classificationValues &&
        !_.isEmpty(parameters.classificationValues)
      ) {
        results = await this.mapNewRiskLevels(
          parameters.classificationValues,
          parameters.sampling
        )
      }

      if (results?.userResults && results?.userResults.length > 0) {
        await liveTestingResultRepository.saveLiveTestingResults(
          results.userResults.map((userResult) => ({
            taskId: parameters.taskId,
            type: 'PULSE',
            ...userResult,
          }))
        )
        await liveTestingTaskRepository.updateStatistics(
          parameters.taskId,
          this.getStatistics(results)
        )
      }
    } catch (e) {
      await liveTestingTaskRepository.updateTaskStatus(
        parameters.taskId,
        'FAILED'
      )
      throw e
    }

    await liveTestingTaskRepository.updateTaskStatus(
      parameters.taskId,
      'SUCCESS'
    )
  }

  private getRiskTypeStatistics(
    riskType: 'KRS' | 'ARS' | 'DRS',
    riskLevels: RiskLevel[]
  ) {
    return Object.entries(_.countBy(riskLevels)).map((entry) => ({
      count: entry[1],
      riskType,
      riskLevel: entry[0] as RiskLevel,
    }))
  }

  private getStatistics(
    results: SimulationResult
  ): LiveTestPulseStatisticsResult {
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
    sampling?: LiveTestPulseSampling
  ): Promise<SimulationResult> {
    const currentClassificationValues =
      await this.riskRepository!.getRiskClassificationValues()
    const users = await this.usersRepository!.getMongoAllUsers({
      pageSize: sampling?.usersCount ?? Number.MAX_SAFE_INTEGER,
    })
    const userResults: Array<Omit<LiveTestPulseResult, 'taskId' | 'type'>> = []
    const transactionResults = {
      current: [] as RiskLevel[],
      simulated: [] as RiskLevel[],
    }
    for (const user of users.data) {
      const userTransactions = await this.getUserTransactions(
        user.userId,
        sampling
      )
      const currentTransactionRiskLevels = userTransactions
        .map(
          (transaction) =>
            transaction.arsScore?.arsScore &&
            getRiskLevelFromScore(
              currentClassificationValues,
              transaction.arsScore.arsScore
            )
        )
        .filter(Boolean) as RiskLevel[]
      const simulatedTransactionRiskLevels = userTransactions
        .map(
          (transaction) =>
            transaction.arsScore?.arsScore &&
            getRiskLevelFromScore(
              newClassificationValues,
              transaction.arsScore.arsScore
            )
        )
        .filter(Boolean) as RiskLevel[]
      transactionResults.current.push(...currentTransactionRiskLevels)
      transactionResults.simulated.push(...simulatedTransactionRiskLevels)

      userResults.push({
        userId: user.userId,
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
    }
    return {
      userResults,
      transactionResults,
    }
  }

  private async recalculateRiskScores(
    classificationValues: RiskClassificationScore[] | undefined,
    parameterAttributeRiskValues: ParameterAttributeRiskValues[],
    sampling?: LiveTestPulseSampling
  ): Promise<SimulationResult> {
    const currentClassificationValues =
      await this.riskRepository!.getRiskClassificationValues()
    const newClassificationValues = _.isEmpty(classificationValues)
      ? currentClassificationValues
      : (classificationValues as RiskClassificationScore[])
    const users = await this.usersRepository!.getMongoAllUsers({
      pageSize: sampling?.usersCount ?? Number.MAX_SAFE_INTEGER,
    })

    const userResults: Array<Omit<LiveTestPulseResult, 'taskId' | 'type'>> = []
    const transactionResults = {
      current: [] as RiskLevel[],
      simulated: [] as RiskLevel[],
    }
    for (const user of users.data) {
      const userKrsScore = await this.riskScoringService!.calculateKrsScore(
        user,
        newClassificationValues,
        parameterAttributeRiskValues
      )
      const userTransactions = await this.getUserTransactions(
        user.userId,
        sampling
      )
      let userCurrentDrsScore = userKrsScore

      for (const transaction of userTransactions) {
        const arsScore = await this.riskScoringService!.calculateArsScore(
          transaction,
          newClassificationValues,
          parameterAttributeRiskValues
        )
        userCurrentDrsScore = this.riskScoringService!.calculateDrsScore(
          userCurrentDrsScore,
          arsScore
        )
        if (transaction.arsScore?.arsScore) {
          transactionResults.current.push(
            getRiskLevelFromScore(
              currentClassificationValues,
              transaction.arsScore.arsScore
            )
          )
          transactionResults.simulated.push(
            getRiskLevelFromScore(newClassificationValues, arsScore)
          )
        }
      }

      userResults.push({
        userId: user.userId,
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
    }
    return {
      userResults,
      transactionResults,
    }
  }

  private async getUserTransactions(
    userId: string,
    sampling?: LiveTestPulseSampling
  ) {
    const userTransactions = (
      await this.transactionRepository!.getTransactions({
        pageSize:
          sampling?.userLatestTransactionsCount || Number.MAX_SAFE_INTEGER,
        filterUserId: userId,
        sortField: 'timestamp',
        sortOrder: 'descend',
      })
    ).data
    return userTransactions
  }
}

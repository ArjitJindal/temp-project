import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { mean } from 'lodash'
import {
  getRiskLevelFromScore,
  getRiskScoreFromLevel,
} from '@flagright/lib/utils'
import { v4 as uuidv4 } from 'uuid'
import pMap from 'p-map'
import { isConsumerUser } from '../rules-engine/utils/user-rule-utils'
import { LogicData, LogicEvaluator } from '../logic-evaluator/engine'
import { TenantRepository } from '../tenants/repositories/tenant-repository'
import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import { BatchJobRepository } from '../batch-jobs/repositories/batch-job-repository'
import { UserRepository } from '../users/repositories/user-repository'
import { RiskRepository } from './repositories/risk-repository'
import { traceable } from '@/core/xray'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { UserRiskScoreDetails } from '@/@types/openapi-internal/UserRiskScoreDetails'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { FormulaCustom } from '@/@types/openapi-internal/FormulaCustom'
import { FormulaSimpleAvg } from '@/@types/openapi-internal/FormulaSimpleAvg'
import { FormulaLegacyMovingAvg } from '@/@types/openapi-internal/FormulaLegacyMovingAvg'
import { RiskFactorsResult } from '@/@types/openapi-internal/RiskFactorsResult'
import { RiskFactorScoreDetails } from '@/@types/openapi-internal/RiskFactorScoreDetails'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { TransactionRiskScoringResult } from '@/@types/openapi-public/TransactionRiskScoringResult'
import { getContext } from '@/core/utils/context'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { ReRunTrigger } from '@/@types/openapi-internal/ReRunTrigger'
import dayjs from '@/utils/dayjs'

const DEFAULT_RISK_LEVEL = 'HIGH'
const DEFAULT_RISK_SCORE = 75
const CONCURRENCY = 100

@traceable
export class RiskScoringV8Service {
  private riskRepository: RiskRepository
  private tenantRepository: TenantRepository
  private logicEvaluator: LogicEvaluator
  private tenantId: string
  private mongoDb: MongoClient | undefined
  private batchJobRepository?: BatchJobRepository
  constructor(
    tenantId: string,
    logicEvaluator: LogicEvaluator,
    connections: { mongoDb?: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    this.riskRepository = new RiskRepository(tenantId, connections)
    this.tenantRepository = new TenantRepository(tenantId, {
      dynamoDb: connections.dynamoDb,
    })
    this.logicEvaluator = logicEvaluator
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
    if (this.mongoDb) {
      this.batchJobRepository = new BatchJobRepository(tenantId, this.mongoDb)
    }
  }

  private async getMongo() {
    if (!this.mongoDb) {
      this.mongoDb = await getMongoDbClient()
    }
    return this.mongoDb
  }

  public async calculateRiskFactorsScore(
    riskData: LogicData,
    riskFactor: RiskFactor[]
  ): Promise<{
    riskFactorsResult: RiskFactorsResult
  }> {
    const result = await Promise.all(
      riskFactor.map(async (factor): Promise<RiskFactorScoreDetails> => {
        let result: RiskFactorScoreDetails | undefined
        const logicDetailsArray = (factor.riskLevelLogic ?? []).sort(
          (a, b) => a.riskScore - b.riskScore
        )
        for (const logicDetails of logicDetailsArray) {
          const logic = logicDetails.logic
          const { hit, vars } = await this.logicEvaluator.evaluate(
            logic,
            {
              agg: factor.logicAggregationVariables,
              entity: factor.logicEntityVariables,
            },
            {
              tenantId: this.tenantId,
              baseCurrency: factor.baseCurrency ?? 'USD', // ToDo: Check if this is correct
            },
            riskData
          )
          if (hit) {
            result = {
              riskFactorId: factor.id,
              vars: vars,
              riskLevel: logicDetails.riskLevel,
              score: logicDetails.riskScore,
              hit: true,
              weight: logicDetails.weight,
            }
            break
          }
        }
        // Handle Aggregation for Transaction factors
        if (riskData.type === 'TRANSACTION') {
          await this.logicEvaluator.handleV8Aggregation(
            'RISK',
            factor.logicAggregationVariables ?? [],
            riskData.transaction,
            riskData.transactionEvents
          )
        }
        return (
          result ?? {
            riskFactorId: factor.id,
            vars: [],
            riskLevel: factor.defaultRiskLevel ?? DEFAULT_RISK_LEVEL,
            score: factor.defaultRiskScore ?? DEFAULT_RISK_SCORE,
            hit: false,
            weight: factor.defaultWeight ?? 0,
          }
        )
      })
    )
    if (!result || result.length === 0) {
      return {
        riskFactorsResult: {
          scoreDetails: [],
          score: DEFAULT_RISK_SCORE,
        },
      }
    }
    // Handle Aggregation for User factors
    if (riskData.type === 'TRANSACTION') {
      const userFactors = await this.getActiveRiskFactors('CONSUMER_USER')
      const businessFactors = await this.getActiveRiskFactors('BUSINESS')
      const allUserFactors = userFactors.concat(businessFactors)
      await Promise.all(
        allUserFactors.map(async (factor) => {
          await this.logicEvaluator.handleV8Aggregation(
            'RISK',
            factor.logicAggregationVariables ?? [],
            riskData.transaction,
            riskData.transactionEvents
          )
        })
      )
    }
    const score = this.calculateWeightedSumScore(result)
    return {
      riskFactorsResult: {
        scoreDetails: result,
        score: score,
      },
    }
  }

  private calculateWeightedSumScore(scores: RiskFactorScoreDetails[]): number {
    const { weightedSum, totalWeight } = scores.reduce(
      (acc, { score, weight }) => ({
        weightedSum: acc.weightedSum + score * weight,
        totalWeight: acc.totalWeight + weight,
      }),
      { weightedSum: 0, totalWeight: 0 }
    )

    return totalWeight === 0 ? 0 : weightedSum / totalWeight
  }

  public async getActiveRiskFactors(type: RiskEntityType) {
    const factors = await this.riskRepository.getAllRiskFactors(type)
    return factors.filter((factor) => factor.status === 'ACTIVE')
  }

  public async handleTransaction(
    transaction: Transaction,
    transactionEvents: TransactionEvent[],
    senderUser?: User | Business,
    receiverUser?: User | Business
  ): Promise<TransactionRiskScoringResult> {
    const { originUser, destinationUser } = {
      originUser: senderUser,
      destinationUser: receiverUser,
    }
    const riskClassificationValues =
      await this.riskRepository.getRiskClassificationValues()
    const riskFactors = await this.getActiveRiskFactors('TRANSACTION')

    const arsScore = await this.calculateArs(
      transaction,
      transactionEvents,
      riskFactors,
      originUser,
      destinationUser
    )
    const [originAvgArs, destinationAvgArs] = await Promise.all([
      this.updateAverageArs(
        arsScore.score,
        originUser?.userId,
        transaction.transactionId,
        transactionEvents.length > 1
      ),
      this.updateAverageArs(
        arsScore.score,
        destinationUser?.userId,
        transaction.transactionId,
        transactionEvents.length > 1
      ),
    ])
    await this.createOrUpdateArsScore(
      transaction,
      arsScore,
      originUser,
      destinationUser
    )

    const { riskScoringCraEnabled = true } = await this.getTenantSettings()
    if (riskScoringCraEnabled === false) {
      return {
        trsScore: arsScore.score,
        trsRiskLevel: getRiskLevelFromScore(
          riskClassificationValues,
          arsScore.score
        ),
      }
    }
    const [originDrsScore, destinationDrsScore] = await Promise.all([
      this.updateDrsForTransaction(
        originUser?.userId,
        arsScore.score,
        arsScore.scoreDetails,
        originAvgArs,
        transaction.transactionId
      ),
      this.updateDrsForTransaction(
        destinationUser?.userId,
        arsScore.score,
        arsScore.scoreDetails,
        destinationAvgArs,
        transaction.transactionId
      ),
    ])
    return {
      trsScore: arsScore.score,
      trsRiskLevel: getRiskLevelFromScore(
        riskClassificationValues,
        arsScore.score
      ),
      originUserCraRiskScore: originDrsScore ?? DEFAULT_RISK_SCORE,
      originUserCraRiskLevel: this.getRiskLevelOrDefault(
        riskClassificationValues,
        originDrsScore
      ),
      destinationUserCraRiskScore: destinationDrsScore ?? DEFAULT_RISK_SCORE,
      destinationUserCraRiskLevel: this.getRiskLevelOrDefault(
        riskClassificationValues,
        destinationDrsScore
      ),
    }
  }

  private getRiskLevelOrDefault(
    riskClassificationValues: Array<RiskClassificationScore>,
    score?: number
  ) {
    return score
      ? getRiskLevelFromScore(riskClassificationValues, score)
      : DEFAULT_RISK_LEVEL
  }

  public async updateDrsForTransaction(
    userId: string | undefined,
    arsScore: number,
    factorScoreDetails: RiskFactorScoreDetails[] | undefined,
    avgArsScore: number | null,
    transactionId: string
  ) {
    if (!userId || !arsScore) {
      return
    }
    const oldDrsScore = await this.getDrsScore(userId)
    if (oldDrsScore?.isUpdatable === false) {
      return oldDrsScore.drsScore
    }
    const { riskScoringAlgorithm = { type: 'FORMULA_SIMPLE_AVG' } } =
      await this.getTenantSettings() // Default to simple average if no algorithm is set
    const krsScore = await this.getKrsScoreValue(userId)
    const newDrsScore = this.calculateNewDrsScore({
      algorithm: riskScoringAlgorithm,
      oldDrsScore: oldDrsScore?.drsScore,
      krsScore: krsScore,
      avgArsScore: avgArsScore,
      arsScore: arsScore,
    })

    await this.updateDrsScore(
      userId,
      newDrsScore,
      transactionId,
      factorScoreDetails
    )
    return newDrsScore
  }

  public calculateNewDrsScore(params: {
    algorithm: FormulaCustom | FormulaLegacyMovingAvg | FormulaSimpleAvg
    oldDrsScore?: number
    krsScore?: number | null
    avgArsScore?: number | null
    arsScore?: number
    userEvent?: boolean
  }): number {
    const {
      algorithm,
      oldDrsScore,
      krsScore,
      avgArsScore,
      arsScore,
      userEvent,
    } = params
    if (algorithm.type === 'FORMULA_LEGACY_MOVING_AVG') {
      if (userEvent) {
        return oldDrsScore ? mean([oldDrsScore, krsScore]) : krsScore ?? 0
      }
      return oldDrsScore
        ? mean([oldDrsScore, arsScore])
        : mean([arsScore, krsScore])
    }

    const { krsWeight = 0.5, avgArsWeight = 0.5 } =
      algorithm.type === 'FORMULA_CUSTOM' ? algorithm : {}
    const totalWeight =
      (krsScore ? krsWeight : 0) + (avgArsScore ? avgArsWeight : 0)
    return (
      (krsWeight * (krsScore ?? 0) +
        avgArsWeight * (avgArsScore ?? arsScore ?? 0)) /
      (totalWeight === 0 ? 1 : totalWeight) // To avoid division by zero
    )
  }

  public async updateDrsScore(
    userId: string,
    drsScore: number,
    transactionId: string,
    factorScoreDetails?: RiskFactorScoreDetails[],
    isUpdatable?: boolean
  ) {
    await this.riskRepository.createOrUpdateDrsScore(
      userId,
      drsScore,
      transactionId,
      [],
      isUpdatable ?? true,
      factorScoreDetails
    )
  }

  private async calculateArs(
    transaction: Transaction,
    transactionEvents: TransactionEvent[],
    riskFactors: RiskFactor[],
    originUser?: User | Business,
    destinationUser?: User | Business
  ) {
    const { riskFactorsResult: arsScore } =
      await this.calculateRiskFactorsScore(
        {
          transaction,
          senderUser: originUser,
          receiverUser: destinationUser,
          transactionEvents: transactionEvents,
          type: 'TRANSACTION',
        },
        riskFactors
      )
    return arsScore
  }

  private async createOrUpdateArsScore(
    transaction: Transaction,
    arsScore: RiskFactorsResult,
    originUser?: User | Business,
    destinationUser?: User | Business
  ) {
    await this.riskRepository.createOrUpdateArsScore(
      transaction.transactionId,
      arsScore.score,
      originUser?.userId,
      destinationUser?.userId,
      [],
      arsScore.scoreDetails
    )
  }

  public async updateAverageArs(
    newArsScore: number,
    userId: string | undefined,
    transactionId: string,
    isEvent?: boolean
  ): Promise<number | null> {
    if (!userId) {
      return null
    }
    const averageArsScore = await this.riskRepository.getAverageArsScore(userId)
    if (!averageArsScore) {
      await this.riskRepository.updateOrCreateAverageArsScore(userId, {
        userId,
        value: newArsScore,
        transactionCount: 1,
        createdAt: Date.now(),
      })
      return newArsScore
    }
    const existingAvgScore = averageArsScore.value
    const transactionCount = averageArsScore?.transactionCount
    let updatedArsScore: number | undefined
    /* To avoid adding average ars score for every transaction event */
    if (isEvent) {
      const existingArsScore = await this.getArsScore(transactionId)
      updatedArsScore =
        (existingAvgScore * transactionCount -
          (existingArsScore?.arsScore || 0) +
          newArsScore) /
        transactionCount
    } else {
      updatedArsScore =
        (existingAvgScore * transactionCount + newArsScore) /
        (transactionCount + 1)
    }
    await this.riskRepository.updateOrCreateAverageArsScore(userId, {
      userId,
      value: updatedArsScore,
      transactionCount: isEvent ? transactionCount : transactionCount + 1,
      createdAt: Date.now(),
    })
    return updatedArsScore
  }

  public async handleUserUpdate(
    user: User | Business,
    manualRiskLevel?: RiskLevel,
    isDrsUpdatable?: boolean
  ): Promise<UserRiskScoreDetails> {
    const userId = user.userId
    const krsScore = await this.getKrsScoreValue(userId)
    const riskClassificationValues =
      await this.riskRepository.getRiskClassificationValues()
    const riskFactors = await this.getActiveRiskFactors(
      isConsumerUser(user) ? 'CONSUMER_USER' : 'BUSINESS'
    )

    const { riskFactorsResult: newKrsScore } =
      await this.calculateRiskFactorsScore({ user, type: 'USER' }, riskFactors)
    await this.riskRepository.createOrUpdateKrsScore(
      userId,
      newKrsScore.score,
      [],
      newKrsScore.scoreDetails
    )

    const { riskScoringCraEnabled = true } = await this.getTenantSettings()

    let craRiskScore: number | undefined = newKrsScore.score
    if (riskScoringCraEnabled) {
      if (!krsScore) {
        await this.updateDrsScore(
          userId,
          newKrsScore.score,
          'FIRST_DRS',
          newKrsScore.scoreDetails,
          isDrsUpdatable
        )
      } else {
        craRiskScore = await this.updateDrsForUserChange(
          userId,
          newKrsScore.score,
          newKrsScore.scoreDetails,
          isDrsUpdatable
        )
      }
    }
    if (manualRiskLevel) {
      const manualDrsScore = await this.handleManualRiskLevelUpdate(
        { ...user, riskLevel: manualRiskLevel },
        isDrsUpdatable
      )
      craRiskScore = getRiskScoreFromLevel(
        riskClassificationValues,
        manualDrsScore.manualRiskLevel ?? DEFAULT_RISK_LEVEL
      )
    }

    return this.formatUserRiskScores(
      riskClassificationValues,
      newKrsScore.score,
      craRiskScore,
      riskScoringCraEnabled
    )
  }

  private formatUserRiskScores(
    riskClassificationValues: RiskClassificationScore[],
    kycRiskScore: number,
    craRiskScore: number | undefined,
    craEnabled: boolean
  ) {
    if (craEnabled === false) {
      return {
        kycRiskScore,
        kycRiskLevel: getRiskLevelFromScore(
          riskClassificationValues,
          kycRiskScore
        ),
      }
    }
    return {
      kycRiskScore,
      kycRiskLevel: getRiskLevelFromScore(
        riskClassificationValues,
        kycRiskScore
      ),
      craRiskScore: craRiskScore ?? DEFAULT_RISK_SCORE,
      craRiskLevel: getRiskLevelFromScore(
        riskClassificationValues,
        craRiskScore ?? DEFAULT_RISK_SCORE
      ),
    }
  }

  public async updateDrsForUserChange(
    userId: string,
    krsScore: number,
    factorScoreDetails?: RiskFactorScoreDetails[],
    isUpdatable?: boolean
  ) {
    const oldDrsScore = await this.getDrsScore(userId)
    if (oldDrsScore?.isUpdatable === false && !isUpdatable) {
      return oldDrsScore.drsScore
    }
    const avgArsScore = await this.riskRepository.getAverageArsScore(userId)
    const { riskScoringAlgorithm = { type: 'FORMULA_SIMPLE_AVG' } } =
      await this.getTenantSettings() // Default to simple average if no algorithm is set
    const newDrsScore = this.calculateNewDrsScore({
      algorithm: riskScoringAlgorithm,
      oldDrsScore: oldDrsScore?.drsScore,
      krsScore: krsScore,
      avgArsScore: avgArsScore?.value ?? null,
      arsScore: undefined,
      userEvent: true,
    })
    await this.updateDrsScore(
      userId,
      newDrsScore,
      'USER_UPDATE',
      factorScoreDetails,
      isUpdatable
    )
    return newDrsScore
  }

  private async handleBatch<T>(
    items: T[],
    processor: (batch: T) => Promise<void>
  ) {
    await pMap(
      items,
      async (item) => {
        await processor(item)
      },
      { concurrency: CONCURRENCY }
    )
  }

  private async processTransactions(
    transactionIds: string[]
  ): Promise<{ arsScoreSum: number; transactionCount: number }> {
    let arsScoreSum = 0
    let transactionCount = 0

    await this.handleBatch(transactionIds, async (transactionId) => {
      const arsScore = await this.getArsScore(transactionId)
      if (arsScore != null) {
        arsScoreSum += arsScore.arsScore
        transactionCount++
      }
    })

    return { arsScoreSum, transactionCount }
  }

  private async processUser(
    userId: string,
    transactionsRepo: MongoDbTransactionRepository
  ) {
    const userTransactions = transactionsRepo.getTransactionsCursor({
      filterUserId: userId,
    })
    let arsScoreSum = 0
    let transactionCount = 0
    let batchTransactionIds: string[] = []

    for await (const transaction of userTransactions) {
      batchTransactionIds.push(transaction.transactionId)
      if (batchTransactionIds.length === 10000) {
        const { arsScoreSum: batchSum, transactionCount: batchCount } =
          await this.processTransactions(batchTransactionIds)
        arsScoreSum += batchSum
        transactionCount += batchCount
        batchTransactionIds = []
      }
    }

    if (batchTransactionIds.length > 0) {
      const { arsScoreSum: batchSum, transactionCount: batchCount } =
        await this.processTransactions(batchTransactionIds)
      arsScoreSum += batchSum
      transactionCount += batchCount
    }

    if (transactionCount > 0) {
      await this.riskRepository.updateOrCreateAverageArsScore(userId, {
        userId,
        value: arsScoreSum / transactionCount,
        transactionCount,
        createdAt: Date.now(),
      })
    }
  }

  private async updateBatchUserAverageArsScore() {
    const userRepository = new UserRepository(this.tenantId, {
      mongoDb: this.mongoDb,
    })
    const userCursor = userRepository.getAllUsersCursor()
    const transactionsRepo = new MongoDbTransactionRepository(
      this.tenantId,
      await this.getMongo()
    )
    let batchUserIds: string[] = []

    for await (const user of userCursor) {
      batchUserIds.push(user.userId)
      if (batchUserIds.length === 10000) {
        await this.handleBatch(batchUserIds, async (userId) => {
          await this.processUser(userId, transactionsRepo)
        })
        batchUserIds = []
      }
    }

    if (batchUserIds.length > 0) {
      await this.handleBatch(batchUserIds, async (userId) => {
        await this.processUser(userId, transactionsRepo)
      })
    }
  }

  public async backFillAvgTrs(): Promise<void> {
    await this.riskRepository.setAvgArsReadyMarker(false)
    await this.updateBatchUserAverageArsScore()
    await this.riskRepository.setAvgArsReadyMarker(true)
  }

  public async handleReRunTriggers(
    trigger: ReRunTrigger,
    params: { userIds?: string[]; clearedListId?: string }
  ) {
    const { userIds, clearedListId } = params
    if (!this.batchJobRepository) {
      this.mongoDb = await getMongoDbClient()
      this.batchJobRepository = new BatchJobRepository(
        this.tenantId,
        this.mongoDb
      )
    }
    const settings = await this.getTenantSettings()
    if (!settings.reRunRiskScoringTriggers?.includes(trigger)) {
      return
    }
    const pendingJobs = await this.batchJobRepository.getJobsByStatus(
      ['PENDING'],
      {
        filterType: 'RISK_SCORING_RECALCULATION',
      }
    )
    const jobsToCheck = pendingJobs.sort((jobA, jobB) => {
      return (
        (jobB.latestStatus.scheduledAt ?? 0) -
        (jobA.latestStatus.scheduledAt ?? 0)
      )
    })
    if (
      jobsToCheck.length > 0 &&
      jobsToCheck[0].latestStatus.scheduledAt &&
      jobsToCheck[0].latestStatus.scheduledAt - Date.now() > 5 * 1000 // Adding this to not update the job that might have been sent in the batch job queue already.
    ) {
      const targetJob = jobsToCheck[0]
      const updateData: any = {
        $set: {
          'latestStatus.scheduledAt': {
            $add: ['$latestStatus.scheduledAt', 15 * 60 * 1000],
          },
        },
      }

      if (clearedListId) {
        updateData.$push = {
          'parameters.clearedListIds': clearedListId,
        }
      }

      if (userIds && userIds.length > 0) {
        updateData.$push = {
          ...updateData.$push,
          'parameters.userIds': { $each: userIds },
        }
      }
      await this.batchJobRepository.updateJob(targetJob.jobId, updateData)
    } else {
      await this.batchJobRepository.insertJob(
        {
          tenantId: this.tenantId,
          jobId: uuidv4(),
          type: 'RISK_SCORING_RECALCULATION',
          parameters: {
            userIds,
            clearedListIds: clearedListId ? [clearedListId] : undefined,
          },
        },
        dayjs().add(15, 'minutes').valueOf()
      )
    }
  }

  private async getTenantSettings(): Promise<TenantSettings> {
    const settings = getContext()?.settings
    if (!settings) {
      return this.tenantRepository.getTenantSettings()
    }
    return settings
  }

  public async handleManualRiskLevelUpdate(
    user: User | Business,
    isUpdatable?: boolean
  ) {
    const drsScore = await this.getDrsScore(user.userId)
    if (drsScore?.isUpdatable === false && !isUpdatable) {
      return drsScore
    }
    return await this.riskRepository.createOrUpdateManualDRSRiskItem(
      user.userId,
      user.riskLevel ?? 'VERY_HIGH',
      isUpdatable
    )
  }

  public async getDrsScore(userId: string) {
    const drsScore = await this.riskRepository.getDrsScore(userId)
    if (!drsScore) {
      return null
    }
    return drsScore
  }

  public async getKrsScoreValue(userId: string) {
    const krsScore = await this.riskRepository.getKrsScore(userId)
    if (!krsScore) {
      return null
    }
    return krsScore.krsScore
  }

  public async getKrsScore(userId: string) {
    const krsScore = await this.riskRepository.getKrsScore(userId)
    if (!krsScore) {
      return null
    }
    return krsScore
  }

  public async getArsScore(transactionId: string): Promise<ArsScore | null> {
    const arsScore = await this.riskRepository.getArsScore(transactionId)
    return arsScore
  }
}

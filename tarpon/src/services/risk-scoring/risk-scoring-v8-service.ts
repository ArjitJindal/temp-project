import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { mean, memoize } from 'lodash'
import {
  getRiskLevelFromScore,
  getRiskScoreFromLevel,
} from '@flagright/lib/utils'
import { UserRepository } from '../users/repositories/user-repository'
import { TenantService } from '../tenants'
import { isConsumerUser } from '../rules-engine/utils/user-rule-utils'
import { LogicData } from '../logic-evaluator/engine'
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

const DEFAULT_RISK_LEVEL = 'VERY_HIGH'
const DEFAULT_RISK_SCORE = 75

@traceable
export class RiskScoringV8Service {
  private riskRepository: RiskRepository
  private userRepository: UserRepository
  private tenantService: TenantService
  /* ToDo:  Common Logic Evaluator to be passed thought the constructor in FR-5482 */
  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb?: DynamoDBDocumentClient }
  ) {
    this.riskRepository = new RiskRepository(tenantId, connections)
    this.userRepository = new UserRepository(tenantId, connections)
    this.tenantService = new TenantService(tenantId, connections)
  }

  private async calculateRiskFactorScore(
    /* ToDo: After V8 Rules Engine migrated to Logic Evaluator Update Type */
    _riskData: LogicData,
    _riskFactor: RiskFactor[]
  ) {
    /* To be implemented */
    return 0
  }

  public async getActiveRiskFactors(type: RiskEntityType) {
    const factors = await this.riskRepository.getAllRiskFactors(type)
    return factors.filter((factor) => factor.status === 'ACTIVE')
  }

  public async handleTransaction(transaction: Transaction) {
    const { originUser, destinationUser } = await this.getUsersFromTransaction(
      transaction
    )
    const riskClassificationValues =
      await this.riskRepository.getRiskClassificationValues()
    const riskFactors = await this.getActiveRiskFactors('TRANSACTION')

    const arsScore = await this.calculateAndUpdateArs(
      transaction,
      riskFactors,
      originUser,
      destinationUser
    )
    const [originAvgArs, destinationAvgArs] = await Promise.all([
      this.updateAverageArs(arsScore, originUser?.userId),
      this.updateAverageArs(arsScore, destinationUser?.userId),
    ])

    const [originDrsScore, destinationDrsScore] = await Promise.all([
      this.updateDrsForTransaction(
        originUser?.userId,
        arsScore,
        originAvgArs,
        transaction.transactionId
      ),
      this.updateDrsForTransaction(
        destinationUser?.userId,
        arsScore,
        destinationAvgArs,
        transaction.transactionId
      ),
    ])
    return {
      arsScore,
      arsRiskLevel: getRiskLevelFromScore(riskClassificationValues, arsScore),
      originUserCraScore: originDrsScore ?? DEFAULT_RISK_SCORE,
      originUserCraRiskLevel: this.getRiskLevelOrDefault(
        riskClassificationValues,
        originDrsScore
      ),
      destinationUserCraScore: destinationDrsScore ?? DEFAULT_RISK_SCORE,
      destinationUserCraRiskLevel: this.getRiskLevelOrDefault(
        riskClassificationValues,
        destinationDrsScore
      ),
    }
  }

  private getRiskLevelOrDefault(riskClassificationValues, score) {
    return score
      ? getRiskLevelFromScore(riskClassificationValues, score)
      : DEFAULT_RISK_LEVEL
  }

  public async updateDrsForTransaction(
    userId: string | undefined,
    arsScore: number,
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
    const { riskScoringCraEnabled, riskScoringAlgorithm } =
      await this.tenantService.getTenantSettings()
    if (!riskScoringCraEnabled || !riskScoringAlgorithm) {
      return
    }
    const krsScore = await this.getKrsScore(userId)
    const newDrsScore = this.calculateNewDrsScore({
      algorithm: riskScoringAlgorithm,
      oldDrsScore: oldDrsScore?.drsScore,
      krsScore: krsScore,
      avgArsScore: avgArsScore,
      arsScore: arsScore,
    })

    await this.updateDrsScore(userId, newDrsScore, transactionId)
    return newDrsScore
  }

  public calculateNewDrsScore(params: {
    algorithm: FormulaCustom | FormulaLegacyMovingAvg | FormulaSimpleAvg
    oldDrsScore: number | undefined
    krsScore: number | null
    avgArsScore: number | null
    arsScore: number | undefined
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
    return (
      krsWeight * (krsScore ?? 0) +
      avgArsWeight * (avgArsScore ?? arsScore ?? 0)
    )
  }

  public async updateDrsScore(
    userId: string,
    drsScore: number,
    transactionId: string
  ) {
    /* ToDo: To take care of components */
    await this.riskRepository.createOrUpdateDrsScore(
      userId,
      drsScore,
      transactionId,
      []
    )
  }

  public async calculateAndUpdateArs(
    transaction: Transaction,
    riskFactors: RiskFactor[],
    originUser?: User | Business,
    destinationUser?: User | Business
  ) {
    const arsScore = await this.calculateRiskFactorScore(
      {
        transaction,
        senderUser: originUser,
        receiverUser: destinationUser,
        // ToDo: Add more data related to TransactionEvents to be passed to the risk engine
        transactionEvents: [],
        type: 'TRANSACTION',
      },
      riskFactors
    )
    await this.riskRepository.createOrUpdateArsScore(
      transaction.transactionId,
      arsScore,
      originUser?.userId,
      destinationUser?.userId
      /* TODO: Think about the components for V8 Risk Scoring  */
    )
    return arsScore
  }

  public async updateAverageArs(
    newArsScore: number,
    userId?: string
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
    const existingScore = averageArsScore.value
    const transactionCount = averageArsScore?.transactionCount
    const updatedArsScore =
      (existingScore * transactionCount + newArsScore) / (transactionCount + 1)
    await this.riskRepository.updateOrCreateAverageArsScore(userId, {
      userId,
      value: updatedArsScore,
      transactionCount: transactionCount + 1,
      createdAt: Date.now(),
    })
    return updatedArsScore
  }

  public async handleUserUpdate(
    user: User | Business
  ): Promise<UserRiskScoreDetails> {
    const userId = user.userId
    const krsScore = await this.getKrsScore(userId)
    const riskClassificationValues =
      await this.riskRepository.getRiskClassificationValues()
    const riskFactors = await this.getActiveRiskFactors(
      isConsumerUser(user) ? 'CONSUMER_USER' : 'BUSINESS'
    )

    const newKrsScore = await this.calculateRiskFactorScore(
      { user, type: 'USER' },
      riskFactors
    )
    await this.riskRepository.createOrUpdateKrsScore(userId, newKrsScore)

    let craRiskScore: number | undefined = newKrsScore
    if (!krsScore) {
      await this.updateDrsScore(userId, newKrsScore, 'FIRST_DRS')
    } else {
      craRiskScore = await this.updateDrsForUserChange(userId, newKrsScore)
    }

    if (user.riskLevel) {
      craRiskScore = getRiskScoreFromLevel(
        riskClassificationValues,
        user.riskLevel
      )
      await this.handleManualRiskLevelUpdate(user)
    }

    return this.formatUserRiskScores(
      riskClassificationValues,
      newKrsScore,
      craRiskScore,
      user.riskLevel
    )
  }

  private formatUserRiskScores(
    riskClassificationValues: RiskClassificationScore[],
    kycRiskScore: number,
    craRiskScore: number | undefined,
    userRiskLevel: string | undefined
  ) {
    return {
      kycRiskScore,
      kycRiskLevel: getRiskLevelFromScore(
        riskClassificationValues,
        kycRiskScore
      ),
      craRiskScore: craRiskScore ?? DEFAULT_RISK_SCORE,
      craRiskLevel:
        (userRiskLevel as RiskLevel) ??
        getRiskLevelFromScore(
          riskClassificationValues,
          craRiskScore ?? DEFAULT_RISK_SCORE
        ),
    }
  }

  public async updateDrsForUserChange(userId: string, krsScore: number) {
    const oldDrsScore = await this.getDrsScore(userId)
    if (oldDrsScore?.isUpdatable === false) {
      return oldDrsScore.drsScore
    }
    const { riskScoringCraEnabled, riskScoringAlgorithm } =
      await this.tenantService.getTenantSettings()
    if (!riskScoringCraEnabled || !riskScoringAlgorithm) {
      return
    }
    const newDrsScore = this.calculateNewDrsScore({
      algorithm: riskScoringAlgorithm,
      oldDrsScore: oldDrsScore?.drsScore,
      krsScore: krsScore,
      avgArsScore: null,
      arsScore: undefined,
      userEvent: true,
    })
    await this.updateDrsScore(userId, newDrsScore, 'USER_UPDATE')
    return newDrsScore
  }

  public async handleManualRiskLevelUpdate(user: User | Business) {
    await this.riskRepository.createOrUpdateManualDRSRiskItem(
      user.userId,
      user.riskLevel ?? 'VERY_HIGH'
    )
  }

  public async getDrsScore(userId: string) {
    const drsScore = await this.riskRepository.getDrsScore(userId)
    if (!drsScore) {
      return null
    }
    return drsScore
  }

  public async getKrsScore(userId: string) {
    const krsScore = await this.riskRepository.getKrsScore(userId)
    if (!krsScore) {
      return null
    }
    return krsScore.krsScore
  }

  getUsersFromTransaction = memoize(
    async (transaction: Transaction) => {
      const getUser = async (
        userId: string | undefined
      ): Promise<User | Business | undefined> => {
        if (!userId) {
          return undefined
        }
        return await this.userRepository.getUser<User | Business>(userId)
      }

      const [originUser, destinationUser] = await Promise.all([
        getUser(transaction.originUserId),
        getUser(transaction.destinationUserId),
      ])

      return {
        originUser,
        destinationUser,
      }
    },
    (transaction) => transaction.transactionId
  )
}

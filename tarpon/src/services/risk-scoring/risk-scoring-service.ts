import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

import { FindCursor, MongoClient } from 'mongodb'
import { get, mean, memoize } from 'lodash'
import { UserRepository } from '../users/repositories/user-repository'
import { isConsumerUser } from '../rules-engine/utils/user-rule-utils'
import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import { CaseRepository } from '../rules-engine/repositories/case-repository'
import { RiskRepository } from './repositories/risk-repository'
import {
  DEFAULT_RISK_LEVEL,
  getRiskScoreFromLevel,
  riskLevelPrecendence,
} from './utils'
import {
  getTransactionDerivedRiskFactorHandler,
  getUserDerivedRiskFactorHandler,
} from './derived-risk-factors'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-internal/Business'
import {
  ParameterAttributeRiskValues,
  ParameterAttributeRiskValuesParameterEnum,
  ParameterAttributeRiskValuesTargetIterableParameterEnum,
} from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { RiskParameterLevelKeyValue } from '@/@types/openapi-internal/RiskParameterLevelKeyValue'
import dayjs, { convertToDays } from '@/utils/dayjs'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { PulseAuditLogService } from '@/lambdas/console-api-pulse/services/pulse-audit-log'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskScoreComponent } from '@/@types/openapi-internal/RiskScoreComponent'
import { traceable } from '@/core/xray'
import { logger } from '@/core/logger'

function getDefaultRiskValue(
  riskClassificationValues: Array<RiskClassificationScore>
): number {
  let riskScore = 75 // Make this configurable

  riskClassificationValues.map((value) => {
    if (value.riskLevel === DEFAULT_RISK_LEVEL) {
      riskScore = mean([value.upperBoundRiskScore, value.lowerBoundRiskScore])
    }
  })

  return riskScore
}

function matchParameterValue(
  valueToMatch: unknown,
  parameterValue: RiskParameterValue
): boolean {
  switch (parameterValue.content.kind) {
    case 'LITERAL': {
      if (valueToMatch === 'undefined') {
        return parameterValue.content.content === undefined
      }
      return parameterValue.content.content === valueToMatch
    }
    case 'MULTIPLE':
      return parameterValue.content.values.some(
        (x) => x.content === valueToMatch
      )
    case 'RANGE':
      return (
        typeof valueToMatch === 'number' &&
        (parameterValue.content.start == null ||
          valueToMatch >= parameterValue.content.start) &&
        (parameterValue.content.end == null ||
          valueToMatch <= parameterValue.content.end)
      )
    case 'TIME_RANGE': {
      // America/Adak (GMT-10:00) Time Zone Example
      const utcOffset = parameterValue.content.timezone.split(' ')[0]
      const timestamp = valueToMatch as number
      const locationTimeHours = dayjs(timestamp).tz(utcOffset).hour()
      return (
        locationTimeHours >= parameterValue.content.startHour &&
        locationTimeHours < parameterValue.content.endHour
      )
    }

    case 'DAY_RANGE': {
      const days = valueToMatch as number
      const start = convertToDays(
        parameterValue.content.start,
        parameterValue.content.startGranularity
      )

      if (
        parameterValue.content.endGranularity === 'INFINITE' &&
        days >= start
      ) {
        return true
      }

      const end = convertToDays(
        parameterValue.content.end,
        parameterValue.content.endGranularity
      )

      return days >= start && days <= end
    }
    default:
      return false
  }
}

function getIterableAttributeRiskLevel(
  parameterAttributeDetails: ParameterAttributeRiskValues,
  entity: User | Business | Transaction
): {
  value: unknown
  riskLevel: RiskLevel
} {
  const { parameter, targetIterableParameter, riskLevelAssignmentValues } =
    parameterAttributeDetails
  const iterableValue = get(entity, parameter) as unknown as any[]
  let individualRiskLevel
  let iterableMaxRiskLevel: {
    value: unknown
    riskLevel: RiskLevel
  } = {
    value: null,
    riskLevel: 'VERY_LOW' as RiskLevel,
  }
  if (iterableValue && targetIterableParameter) {
    iterableValue.forEach((value: any) => {
      individualRiskLevel = getSchemaAttributeRiskLevel(
        targetIterableParameter,
        value,
        riskLevelAssignmentValues,
        parameterAttributeDetails.defaultRiskLevel ?? DEFAULT_RISK_LEVEL
      )
      if (
        riskLevelPrecendence[individualRiskLevel.riskLevel] >=
        riskLevelPrecendence[iterableMaxRiskLevel.riskLevel]
      ) {
        iterableMaxRiskLevel = individualRiskLevel
      }
    })
    return iterableMaxRiskLevel
  } else if (iterableValue && !targetIterableParameter) {
    let hasRiskValueMatch = false
    iterableValue.forEach((value: unknown) => {
      const { riskLevelAssignmentValues } = parameterAttributeDetails
      for (const riskLevelAssignmentValue of riskLevelAssignmentValues) {
        if (
          matchParameterValue(value, riskLevelAssignmentValue.parameterValue)
        ) {
          if (
            riskLevelPrecendence[riskLevelAssignmentValue.riskLevel] >=
            riskLevelPrecendence[iterableMaxRiskLevel.riskLevel]
          ) {
            iterableMaxRiskLevel = {
              value,
              riskLevel: riskLevelAssignmentValue.riskLevel,
            }
            hasRiskValueMatch = true
          }
        }
      }
    })
    return hasRiskValueMatch
      ? iterableMaxRiskLevel
      : {
          value: null,
          riskLevel:
            parameterAttributeDetails.defaultRiskLevel ?? DEFAULT_RISK_LEVEL,
        }
  }
  return {
    value: null,
    riskLevel: parameterAttributeDetails.defaultRiskLevel ?? DEFAULT_RISK_LEVEL,
  }
}

function getDerivedAttributeRiskLevel(
  derivedValue: any,
  riskLevelAssignmentValues: Array<RiskParameterLevelKeyValue>,
  isNullableAllowed: boolean | undefined,
  defaultRiskLevel: RiskLevel = DEFAULT_RISK_LEVEL
): RiskLevel {
  if (derivedValue || isNullableAllowed) {
    for (const { parameterValue, riskLevel } of riskLevelAssignmentValues) {
      if (matchParameterValue(derivedValue, parameterValue)) {
        return riskLevel
      }
    }
  }
  return defaultRiskLevel
}

function getSchemaAttributeRiskLevel(
  paramName:
    | ParameterAttributeRiskValuesParameterEnum
    | ParameterAttributeRiskValuesTargetIterableParameterEnum,
  entity: User | Business | Transaction,
  riskLevelAssignmentValues: Array<RiskParameterLevelKeyValue>,
  defaultRiskLevel: RiskLevel
): {
  value: unknown
  riskLevel: RiskLevel
} {
  let resultValue = null
  let resultRiskLevel: RiskLevel = defaultRiskLevel
  const endValue = get(entity, paramName)
  if (endValue) {
    resultValue = endValue
    for (const { parameterValue, riskLevel } of riskLevelAssignmentValues) {
      if (matchParameterValue(endValue, parameterValue)) {
        resultRiskLevel = riskLevel
        break
      }
    }
  }
  return { value: resultValue, riskLevel: resultRiskLevel }
}

@traceable
export class RiskScoringService {
  tenantId: string
  riskRepository: RiskRepository
  userRepository: UserRepository
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient

  constructor(
    tenantId: string,
    connections: {
      dynamoDb?: DynamoDBDocumentClient
      mongoDb: MongoClient
    }
  ) {
    this.tenantId = tenantId
    this.riskRepository = new RiskRepository(tenantId, {
      dynamoDb: connections.dynamoDb,
      mongoDb: connections.mongoDb,
    })
    this.userRepository = new UserRepository(tenantId, {
      mongoDb: connections.mongoDb,
      dynamoDb: connections.dynamoDb,
    })
    this
    this.mongoDb = connections.mongoDb as MongoClient
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
  }

  public async calculateKrsScore(
    user: User | Business,
    riskClassificationValues: RiskClassificationScore[],
    riskFactors: ParameterAttributeRiskValues[]
  ): Promise<{
    score: number
    components: RiskScoreComponent[]
  }> {
    const isUserConsumerUser = isConsumerUser(user)
    const components = await this.getRiskFactorScores(
      isUserConsumerUser ? ['CONSUMER_USER'] : ['BUSINESS'],
      user,
      riskFactors || [],
      riskClassificationValues
    )

    return {
      score: components.length
        ? mean(components.map(({ score }) => score))
        : getDefaultRiskValue(riskClassificationValues),
      components,
    }
  }

  public async handleManualRiskLevel(userPayload: User | Business) {
    await this.riskRepository.createOrUpdateManualDRSRiskItem(
      userPayload.userId,
      userPayload.riskLevel!
    )
  }

  public async calculateArsScore(
    transaction: Transaction,
    riskClassificationValues: RiskClassificationScore[],
    riskFactors: ParameterAttributeRiskValues[]
  ): Promise<{
    score: number
    components: RiskScoreComponent[]
  }> {
    const components = await this.getRiskFactorScores(
      ['TRANSACTION'],
      transaction,
      riskFactors || [],
      riskClassificationValues
    )
    return {
      score: components.length
        ? mean(components.map(({ score }) => score))
        : getDefaultRiskValue(riskClassificationValues),
      components,
    }
  }

  public async reCalculateDrsScoreFromOldArsScores(
    userId: string,
    krsScore: number
  ): Promise<{
    score: number
    components: RiskScoreComponent[]
    transactionId?: string
  }> {
    const cursor = await this.riskRepository.allArsScoresForUser(userId)
    let score = krsScore
    let components: RiskScoreComponent[] = []
    let transactionId: string | undefined

    for await (const arsScore of cursor) {
      score = mean([score, arsScore.arsScore])
      components = arsScore.components ?? []
      transactionId = arsScore.transactionId
    }

    return {
      score,
      components,
      transactionId,
    }
  }

  public async reCalculateKrsAndDrsScores(userId: string): Promise<void> {
    const user = await this.userRepository.getUserById(userId)
    logger.info(`Recalculating KRS and DRS scores for user ${userId}`)
    const { riskFactors, riskClassificationValues } = await this.getRiskConfig()
    if (!user) {
      logger.warn(`User ${userId} not found`)
      return
    }
    logger.info(`Recalculating KRS score for user ${userId}`)
    // Calculate the KRS score
    const { components: krsComponennts, score: krsScore } =
      await this.calculateKrsScore(
        user,
        riskClassificationValues,
        riskFactors || []
      )
    logger.info(`Calculated KRS score for user ${userId} is ${krsScore}`, {
      krsComponennts,
    })
    logger.info(`Recalculating DRS score for user ${userId}`)
    // Calculate the DRS score from the old ARS scores
    const { components, score, transactionId } =
      await this.reCalculateDrsScoreFromOldArsScores(user.userId, krsScore)
    logger.info(`Calculated DRS score for user ${userId} is ${score}`, {
      components,
      transactionId,
    })
    //  Update the KRS and DRS scores
    await this.riskRepository.createOrUpdateKrsScore(
      user.userId,
      krsScore,
      krsComponennts
    )

    await this.riskRepository.createOrUpdateDrsScore(
      user.userId,
      score,
      transactionId ?? 'FIRST_DRS',
      components.length > 0 ? components : krsComponennts
    )

    if (transactionId) {
      const caseRepository = new CaseRepository(this.tenantId, {
        mongoDb: this.mongoDb,
        dynamoDb: this.dynamoDb,
      })
      const transactionRepository = new MongoDbTransactionRepository(
        this.tenantId,
        this.mongoDb
      )
      const transaction = await transactionRepository.getTransactionById(
        transactionId
      )

      if (!transaction) {
        logger.warn(`Transaction ${transactionId} not found`)
        return
      }

      await caseRepository.updateDynamicRiskScores(
        transactionId,
        transaction.originUserId === userId ? score : undefined,
        transaction.destinationUserId === userId ? score : undefined
      )
    }

    logger.info(`Updated KRS and DRS scores for user ${userId}`)
  }

  public calculateDrsScore(
    currentDrsScore: number,
    newArsScore: number
  ): number {
    return mean([currentDrsScore, newArsScore])
  }

  public async updateInitialRiskScores(user: User | Business): Promise<number> {
    const { riskFactors, riskClassificationValues } = await this.getRiskConfig()

    const { score, components } = await this.calculateKrsScore(
      user,
      riskClassificationValues,
      riskFactors || []
    )

    await Promise.all([
      this.riskRepository.createOrUpdateKrsScore(
        user.userId,
        score,
        components
      ),
      this.riskRepository.createOrUpdateDrsScore(
        user.userId,
        score,
        'FIRST_DRS',
        components
      ),
    ])

    return score
  }

  public async updateDynamicRiskScores(transaction: Transaction): Promise<{
    originDrsScore: number | undefined | null
    destinationDrsScore: number | undefined | null
  }> {
    const { riskClassificationValues, riskFactors } = await this.getRiskConfig()
    const { score: arsScore, components } = await this.calculateArsScore(
      transaction,
      riskClassificationValues,
      riskFactors || []
    )

    const [_, originDrsScore, destinationDrsScore] = await Promise.all([
      await this.riskRepository.createOrUpdateArsScore(
        transaction.transactionId,
        arsScore,
        transaction.originUserId,
        transaction.destinationUserId,
        components
      ),
      transaction.originUserId
        ? this.calculateAndUpdateDRS(
            transaction.originUserId,
            arsScore,
            transaction.transactionId,
            components
          )
        : null,
      transaction.destinationUserId
        ? this.calculateAndUpdateDRS(
            transaction.destinationUserId,
            arsScore,
            transaction.transactionId!,
            components
          )
        : null,
    ])

    return { originDrsScore, destinationDrsScore }
  }

  public async getRiskFactorScores(
    entityTypes: RiskEntityType[],
    entity: User | Business | Transaction,
    riskFactors: ParameterAttributeRiskValues[],
    riskClassificationValues: Array<RiskClassificationScore>
  ): Promise<RiskScoreComponent[]> {
    const relevantRiskFactors: ParameterAttributeRiskValues[] =
      riskFactors?.filter(
        (parameterAttributeDetails) =>
          parameterAttributeDetails.isActive &&
          entityTypes.includes(parameterAttributeDetails.riskEntityType)
      ) ?? []

    const result: RiskScoreComponent[] = []
    for (const parameterAttributeDetails of relevantRiskFactors) {
      let matchedRiskLevels: {
        value: unknown
        riskLevel: RiskLevel
      }[] = []
      if (parameterAttributeDetails.isDerived) {
        let derivedValues: any[] = []
        if (
          entityTypes.includes('BUSINESS') ||
          entityTypes.includes('CONSUMER_USER')
        ) {
          const handler = getUserDerivedRiskFactorHandler(
            parameterAttributeDetails.riskEntityType,
            parameterAttributeDetails.parameter
          )
          derivedValues = await handler(
            entity as User,
            parameterAttributeDetails.parameter
          )
        } else if (entityTypes.includes('TRANSACTION')) {
          const handler = getTransactionDerivedRiskFactorHandler(
            parameterAttributeDetails.riskEntityType,
            parameterAttributeDetails.parameter
          )
          derivedValues = await handler(
            entity as Transaction,
            await this.getUsersFromTransaction(entity as Transaction),
            parameterAttributeDetails.parameter,
            this.tenantId
          )
        }
        matchedRiskLevels = derivedValues.map((derivedValue) => ({
          value: derivedValue,
          riskLevel: getDerivedAttributeRiskLevel(
            derivedValue,
            parameterAttributeDetails.riskLevelAssignmentValues,
            parameterAttributeDetails.isNullableAllowed,
            parameterAttributeDetails.defaultRiskLevel ?? DEFAULT_RISK_LEVEL
          ),
        }))
      } else if (parameterAttributeDetails.parameterType == 'VARIABLE') {
        matchedRiskLevels = [
          getSchemaAttributeRiskLevel(
            parameterAttributeDetails.parameter,
            entity,
            parameterAttributeDetails.riskLevelAssignmentValues,
            parameterAttributeDetails.defaultRiskLevel ?? DEFAULT_RISK_LEVEL
          ),
        ]
      } else if (parameterAttributeDetails.parameterType == 'ITERABLE') {
        matchedRiskLevels = [
          getIterableAttributeRiskLevel(parameterAttributeDetails, entity),
        ]
      }

      matchedRiskLevels.forEach(({ riskLevel, value }) =>
        result.push({
          entityType: parameterAttributeDetails.riskEntityType,
          parameter: parameterAttributeDetails.parameter,
          riskLevel,
          value: value,
          score: getRiskScoreFromLevel(riskClassificationValues, riskLevel),
        })
      )
    }
    return result
  }

  public async getKrsScore(userId: string): Promise<number | undefined> {
    const krsScore = await this.riskRepository.getKrsScore(userId)

    if (krsScore == null) {
      return undefined
    }

    return krsScore.krsScore
  }

  public async getDrsScore(userId: string): Promise<number | undefined> {
    const drsScore = await this.riskRepository.getDrsScore(userId)

    if (drsScore == null) {
      return undefined
    }

    return drsScore.drsScore
  }

  private async calculateAndUpdateDRS(
    userId: string,
    arsScore: number,
    transactionId: string,
    components: RiskScoreComponent[]
  ): Promise<number | null | undefined> {
    const krsScore = (await this.riskRepository.getKrsScore(userId))?.krsScore
    if (krsScore == null) {
      return null
    }

    const drsObject = await this.riskRepository.getDrsScore(userId)
    const currentDrsValue = drsObject?.drsScore ?? krsScore

    if (!drsObject?.isUpdatable) {
      return drsObject?.drsScore
    }
    const auditLogService = new PulseAuditLogService(this.tenantId)
    const drsScore = this.calculateDrsScore(currentDrsValue, arsScore)
    await this.riskRepository.createOrUpdateDrsScore(
      userId,
      drsScore,
      transactionId,
      components
    )
    const newDrsObject = await this.riskRepository.getDrsScore(userId)
    await auditLogService.handleDrsUpdate(drsObject, newDrsObject, 'AUTOMATIC')

    return newDrsObject?.drsScore
  }

  public async calculateAndUpdateKRSAndDRS(
    user: User | Business
  ): Promise<void> {
    const { riskFactors, riskClassificationValues } = await this.getRiskConfig()

    const oldKrsScore = (await this.riskRepository.getKrsScore(user.userId))
      ?.krsScore
    const oldDrs = await this.riskRepository.getDrsScore(user.userId)
    const { score: newKrsScore, components } = await this.calculateKrsScore(
      user,
      riskClassificationValues,
      riskFactors || []
    )
    if (newKrsScore === oldKrsScore) {
      return
    }
    await this.riskRepository.createOrUpdateKrsScore(
      user.userId,
      newKrsScore,
      components
    )
    if (!oldDrs?.isUpdatable) {
      return
    }
    const newDRSScore = mean([newKrsScore, oldDrs?.drsScore])
    await this.riskRepository.createOrUpdateDrsScore(
      user.userId,
      newDRSScore,
      'USER_UPDATED',
      components
    )
  }

  public async backfillUserRiskScores(): Promise<void> {
    const users: FindCursor<User> =
      this.userRepository.getUsersWithoutKrsScoreCursor()

    for await (const user of users) {
      if (!user) {
        continue
      }
      await this.updateInitialRiskScores(user)
    }
  }

  public async backfillTransactionRiskScores(
    afterCreatedAt: number,
    beforeCreatedAt: number
  ): Promise<void> {
    const transactionsRepo = new MongoDbTransactionRepository(
      this.tenantId,
      this.mongoDb
    )
    const transactions: FindCursor<Transaction> =
      await transactionsRepo.getTransactionsWithoutArsScoreCursor({
        afterCreatedAt,
        beforeCreatedAt,
      })

    logger.info(
      `Found ${await transactions.count()} transactions for tenant ${
        this.tenantId
      }`
    )

    const caseRepo = new CaseRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    for await (const transaction of transactions) {
      logger.info(
        `Updating ARS score for transaction ${transaction.transactionId}`
      )

      const { originDrsScore, destinationDrsScore } =
        await this.updateDynamicRiskScores(transaction)

      await caseRepo.updateDynamicRiskScores(
        transaction.transactionId,
        originDrsScore,
        destinationDrsScore
      )

      logger.info(
        `Updated ARS score for transaction ${transaction.transactionId}`
      )
    }
  }

  getUsersFromTransaction = memoize(
    async (transaction: Transaction) => {
      const userIds = [
        transaction.originUserId,
        transaction.destinationUserId,
      ].filter(Boolean) as string[]
      const users = await this.userRepository.getMongoUsersByIds(userIds)
      return {
        originUser: users.find(
          (user) => user.userId === transaction.originUserId
        ),
        destinationUser: users.find(
          (user) => user.userId === transaction.destinationUserId
        ),
      }
    },
    (transaction) => transaction.transactionId
  )

  getRiskConfig = memoize(async () => {
    const [riskFactors, riskClassificationValues] = await Promise.all([
      this.riskRepository.getParameterRiskItems(),
      this.riskRepository.getRiskClassificationValues(),
    ])
    return { riskFactors, riskClassificationValues }
  })
}

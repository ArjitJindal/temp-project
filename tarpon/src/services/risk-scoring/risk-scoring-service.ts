import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { FindCursor, MongoClient } from 'mongodb'
import { get, mean, memoize } from 'lodash'
import {
  getRiskLevelFromScore,
  getRiskScoreFromLevel,
} from '@flagright/lib/utils/risk'
import { UserRepository } from '../users/repositories/user-repository'
import { isConsumerUser } from '../rules-engine/utils/user-rule-utils'
import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import { CaseRepository } from '../cases/repository'
import { CurrencyService } from '../currency'
import { RiskRepository } from './repositories/risk-repository'
import {
  DEFAULT_RISK_LEVEL,
  DEFAULT_RISK_VALUE,
  riskLevelPrecendence,
  weightedRiskScoreCalculation,
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
import { PulseAuditLogService } from '@/services/risk/pulse-audit-log'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { RiskScoreComponent } from '@/@types/openapi-internal/RiskScoreComponent'
import { traceable } from '@/core/xray'
import { logger } from '@/core/logger'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { RiskScoreDetails } from '@/@types/openapi-internal/RiskScoreDetails'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { hasFeature } from '@/core/utils/context'
import { UserRiskScoreDetails } from '@/@types/openapi-public/UserRiskScoreDetails'
import { RiskScoreValueLevel } from '@/@types/openapi-internal/RiskScoreValueLevel'
import { RiskScoreValueScore } from '@/@types/openapi-internal/RiskScoreValueScore'

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

async function matchParameterValue(
  valueToMatch: unknown,
  parameterValue: RiskParameterValue
): Promise<boolean> {
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
    case 'AMOUNT_RANGE': {
      const transactionAmountDetails = valueToMatch as TransactionAmountDetails
      const currencyService = new CurrencyService()
      const convertedAmount = (
        await currencyService.getTargetCurrencyAmount(
          transactionAmountDetails,
          parameterValue.content.currency
        )
      ).transactionAmount
      return (
        convertedAmount >= parameterValue.content.start &&
        convertedAmount < parameterValue.content.end
      )
    }
    default:
      return false
  }
}

async function getIterableAttributeRiskLevel(
  parameterAttributeDetails: ParameterAttributeRiskValues,
  entity: User | Business | Transaction
): Promise<{
  value: unknown
  riskValue: RiskScoreValueLevel | RiskScoreValueScore
}> {
  const { parameter, targetIterableParameter, riskLevelAssignmentValues } =
    parameterAttributeDetails
  const iterableValue = get(entity, parameter) as unknown as any[]
  let individualRiskValue: {
    value: unknown
    riskValue: RiskScoreValueLevel | RiskScoreValueScore
  } | null = null

  let iterableMaxRiskLevel: {
    value: unknown
    riskValue: RiskScoreValueLevel | RiskScoreValueScore
  } = {
    value: null,
    riskValue: {
      type: 'RISK_LEVEL',
      value: 'VERY_LOW' as RiskLevel,
    },
  }
  if (iterableValue && targetIterableParameter) {
    for (const value of iterableValue) {
      individualRiskValue = await getSchemaAttributeRiskLevel(
        targetIterableParameter,
        value,
        riskLevelAssignmentValues,
        parameterAttributeDetails.defaultValue ?? DEFAULT_RISK_VALUE
      )

      if (individualRiskValue.riskValue.type === 'RISK_LEVEL') {
        if (
          riskLevelPrecendence[individualRiskValue.riskValue.value] >=
          riskLevelPrecendence[iterableMaxRiskLevel.riskValue.value]
        ) {
          iterableMaxRiskLevel = individualRiskValue
        }
      }
    }

    return iterableMaxRiskLevel
  } else if (iterableValue && !targetIterableParameter) {
    let hasRiskValueMatch = false
    for (const value of iterableValue) {
      const { riskLevelAssignmentValues } = parameterAttributeDetails
      for (const riskLevelAssignmentValue of riskLevelAssignmentValues) {
        const isMatch = await matchParameterValue(
          value,
          riskLevelAssignmentValue.parameterValue
        )

        if (isMatch) {
          if (riskLevelAssignmentValue.riskValue.type === 'RISK_LEVEL') {
            if (
              riskLevelPrecendence[riskLevelAssignmentValue.riskValue.value] >=
              riskLevelPrecendence[iterableMaxRiskLevel.riskValue.value]
            ) {
              iterableMaxRiskLevel = {
                value,
                riskValue: riskLevelAssignmentValue.riskValue,
              }
              hasRiskValueMatch = true
            }
          } else {
            iterableMaxRiskLevel = {
              value,
              riskValue: riskLevelAssignmentValue.riskValue,
            }
            hasRiskValueMatch = true
          }
        }
      }
    }
    return hasRiskValueMatch
      ? iterableMaxRiskLevel
      : {
          value: null,
          riskValue:
            parameterAttributeDetails.defaultValue ?? DEFAULT_RISK_VALUE,
        }
  }
  return {
    value: null,
    riskValue: parameterAttributeDetails.defaultValue ?? DEFAULT_RISK_VALUE,
  }
}

async function getDerivedAttributeRiskLevel(
  derivedValue: any,
  riskLevelAssignmentValues: Array<RiskParameterLevelKeyValue>,
  isNullableAllowed: boolean | undefined,
  defaultValue: RiskScoreValueLevel | RiskScoreValueScore = DEFAULT_RISK_VALUE
): Promise<RiskScoreValueLevel | RiskScoreValueScore> {
  if (derivedValue || isNullableAllowed) {
    for (const { parameterValue, riskValue } of riskLevelAssignmentValues) {
      const isMatch = await matchParameterValue(derivedValue, parameterValue)
      if (isMatch) {
        return riskValue
      }
    }
  }

  return defaultValue
}

async function getSchemaAttributeRiskLevel(
  paramName:
    | ParameterAttributeRiskValuesParameterEnum
    | ParameterAttributeRiskValuesTargetIterableParameterEnum,
  entity: User | Business | Transaction,
  riskLevelAssignmentValues: Array<RiskParameterLevelKeyValue>,
  defaultValue: RiskScoreValueLevel | RiskScoreValueScore
): Promise<{
  value: unknown
  riskValue: RiskScoreValueLevel | RiskScoreValueScore
}> {
  let resultValue: unknown | null = null
  let resultRiskValue: RiskScoreValueLevel | RiskScoreValueScore = defaultValue
  const endValue = get(entity, paramName)

  if (endValue) {
    resultValue = endValue
    for (const { parameterValue, riskValue } of riskLevelAssignmentValues) {
      const isMatch = await matchParameterValue(endValue, parameterValue)

      if (isMatch) {
        resultRiskValue = riskValue
        break
      }
    }
  }
  return { value: resultValue, riskValue: resultRiskValue }
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
      mongoDb?: MongoClient
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

  public async runRiskScoresForUser(
    userPayload: User | Business,
    isDrsUpdatable?: boolean
  ): Promise<UserRiskScoreDetails> {
    let krsScore: number | undefined
    let krsRiskLevel: RiskLevel | undefined
    let craScore: number | undefined
    let craRiskLevel: RiskLevel | undefined

    if (hasFeature('RISK_LEVELS') || hasFeature('RISK_SCORING')) {
      const riskClassificationValues =
        await this.riskRepository.getRiskClassificationValues()

      if (hasFeature('RISK_SCORING')) {
        const score = await this.updateInitialRiskScores(
          userPayload as User | Business,
          isDrsUpdatable
        )

        krsScore = craScore = score

        const riskLevel = getRiskLevelFromScore(riskClassificationValues, score)

        krsRiskLevel = craRiskLevel = riskLevel
      }

      const preDefinedRiskLevel = userPayload.riskLevel

      if (preDefinedRiskLevel) {
        await this.handleManualRiskLevel(
          userPayload as User | Business,
          isDrsUpdatable
        )

        craScore = getRiskScoreFromLevel(
          riskClassificationValues,
          preDefinedRiskLevel
        )

        craRiskLevel = preDefinedRiskLevel
      }
    }

    return {
      craRiskLevel,
      craRiskScore: craScore,
      kycRiskLevel: krsRiskLevel,
      kycRiskScore: krsScore,
    }
  }

  public async calculateKrsScore(
    user: User | Business,
    riskClassificationValues: RiskClassificationScore[],
    riskFactors: ParameterAttributeRiskValues[]
  ): Promise<RiskScoreDetails> {
    logger.info(`Calculating KRS score for user ${user.userId}`)
    const isUserConsumerUser = isConsumerUser(user)
    const allComponents = await Promise.all([
      this.getRiskFactorScores(
        isUserConsumerUser ? ['CONSUMER_USER'] : ['BUSINESS'],
        user,
        riskFactors || [],
        riskClassificationValues
      ),
    ])

    const components = allComponents.flat()

    logger.info(`Calculated KRS score for user ${user.userId}`)
    return {
      score: components.length
        ? weightedRiskScoreCalculation(components)
        : getDefaultRiskValue(riskClassificationValues),
      components,
    }
  }

  public async handleManualRiskLevel(
    userPayload: User | Business,
    isDrsUpdatable?: boolean
  ): Promise<void> {
    await this.riskRepository.createOrUpdateManualDRSRiskItem(
      userPayload.userId,
      userPayload.riskLevel ?? 'VERY_HIGH',
      isDrsUpdatable
    )
  }

  public async simulateArsScore(
    transaction: Transaction,
    riskClassificationValues: RiskClassificationScore[],
    riskFactors: ParameterAttributeRiskValues[]
  ): Promise<RiskScoreDetails> {
    return this.calculateArsScoreInternal(
      transaction,
      riskClassificationValues,
      riskFactors
    )
  }

  public async calculateArsScore(
    transaction: Transaction,
    riskClassificationValues?: RiskClassificationScore[],
    riskFactors?: ParameterAttributeRiskValues[]
  ): Promise<RiskScoreDetails & { riskLevel: RiskLevel }> {
    if (!riskClassificationValues) {
      const riskConfig = await this.getRiskConfig()
      riskClassificationValues = riskConfig.riskClassificationValues
      riskFactors = riskConfig.riskFactors || []
    }

    const ars = await this.calculateArsScoreInternal(
      transaction,
      riskClassificationValues,
      riskFactors || []
    )

    const riskLevel = getRiskLevelFromScore(riskClassificationValues, ars.score)

    return {
      ...ars,
      riskLevel,
    }
  }

  private async calculateArsScoreInternal(
    transaction: Transaction,
    riskClassificationValues: RiskClassificationScore[],
    riskFactors: ParameterAttributeRiskValues[]
  ): Promise<RiskScoreDetails> {
    logger.info(
      `Calculating ARS score for transaction ${transaction.transactionId}`
    )
    const allComponents = await Promise.all([
      this.getRiskFactorScores(
        ['TRANSACTION'],
        transaction,
        riskFactors,
        riskClassificationValues
      ),
    ])

    const components = allComponents.flat()

    logger.info(
      `Calculated ARS score for transaction ${transaction.transactionId}`
    )
    return {
      score: components.length
        ? weightedRiskScoreCalculation(components)
        : getDefaultRiskValue(riskClassificationValues),
      components,
    }
  }

  public async reCalculateDrsScoreFromOldArsScores(
    userId: string,
    krsScore: number
  ): Promise<RiskScoreDetails & { transactionId?: string }> {
    logger.info(`Recalculating DRS score from ond ARS score for user ${userId}`)
    const cursor = await this.riskRepository.allArsScoresForUser(userId)
    let score = krsScore
    let components: RiskScoreComponent[] = []
    let transactionId: string | undefined

    for await (const arsScore of cursor) {
      score = mean([score, arsScore.arsScore])
      components = arsScore.components ?? []
      transactionId = arsScore.transactionId
    }
    logger.info(`Calculated DRS score from ond KRS score for user ${userId}`)

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

  public async updateInitialRiskScores(
    user: User | Business,
    isDrsUpdatable?: boolean
  ): Promise<number> {
    logger.info(`Updating initial risk score for user ${user.userId}`)

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
        components,
        isDrsUpdatable
      ),
    ])

    logger.info(`Updated initial risk score for user ${user.userId}`)

    return score
  }

  public async getArsScore(
    transactionId: string
  ): Promise<ArsScore | undefined> {
    const arsScore = await this.riskRepository.getArsScore(transactionId)

    return arsScore ?? undefined
  }

  private async getArsDetails(
    transaction: Transaction,
    calculateArsScore: boolean = true
  ): Promise<RiskScoreDetails> {
    if (!calculateArsScore) {
      const data = await this.getArsScore(transaction.transactionId)

      if (!data) {
        throw new Error(
          `No ARS score found for transaction ${transaction.transactionId}`
        )
      }

      return { score: data.arsScore, components: data.components ?? [] }
    }

    return this.calculateArsScore(transaction)
  }

  public async updateDynamicRiskScores(
    transaction: Transaction,
    calculateArsScore: boolean = true
  ): Promise<{
    originDrsScore: number | undefined | null
    destinationDrsScore: number | undefined | null
  }> {
    const { score: arsScore, components } = await this.getArsDetails(
      transaction,
      calculateArsScore
    )

    const [_, originDrsScore, destinationDrsScore] = await Promise.all([
      calculateArsScore
        ? await this.riskRepository.createOrUpdateArsScore(
            transaction.transactionId,
            arsScore,
            transaction.originUserId,
            transaction.destinationUserId,
            components
          )
        : null,
      transaction.originUserId
        ? this.calculateAndUpdateDRS(
            transaction.originUserId,
            arsScore,
            transaction.transactionId,
            components ?? []
          )
        : null,
      transaction.destinationUserId
        ? this.calculateAndUpdateDRS(
            transaction.destinationUserId,
            arsScore,
            transaction.transactionId,
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
          entityTypes.includes(parameterAttributeDetails.riskEntityType) &&
          parameterAttributeDetails.weight > 0
      ) ?? []

    const result: RiskScoreComponent[] = []
    for (const parameterAttributeDetails of relevantRiskFactors) {
      let matchedRiskLevels: {
        value: unknown
        riskValue: RiskScoreValueLevel | RiskScoreValueScore
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
          if (!handler) {
            logger.error(
              `No handler found for risk factor ${parameterAttributeDetails.parameter}`
            )
            continue
          }
          derivedValues = await handler(
            entity as User,
            parameterAttributeDetails.parameter
          )
        } else if (entityTypes.includes('TRANSACTION')) {
          const handler = getTransactionDerivedRiskFactorHandler(
            parameterAttributeDetails.riskEntityType,
            parameterAttributeDetails.parameter
          )
          if (!handler) {
            logger.error(
              `No handler found for risk factor ${parameterAttributeDetails.parameter}`
            )
            continue
          }
          derivedValues = await handler(
            entity as Transaction,
            await this.getUsersFromTransaction(entity as Transaction),
            parameterAttributeDetails.parameter,
            this.tenantId
          )
        }
        matchedRiskLevels = await Promise.all(
          derivedValues.map(async (derivedValue) => ({
            value: derivedValue,
            riskValue: await getDerivedAttributeRiskLevel(
              derivedValue,
              parameterAttributeDetails.riskLevelAssignmentValues,
              parameterAttributeDetails.isNullableAllowed,
              parameterAttributeDetails.defaultValue ?? DEFAULT_RISK_VALUE
            ),
          }))
        )
        if (derivedValues.length === 0) {
          matchedRiskLevels = [
            {
              value: null,
              riskValue:
                parameterAttributeDetails.defaultValue ?? DEFAULT_RISK_VALUE,
            },
          ]
        }
      } else if (parameterAttributeDetails.parameterType == 'VARIABLE') {
        matchedRiskLevels = [
          await getSchemaAttributeRiskLevel(
            parameterAttributeDetails.parameter,
            entity,
            parameterAttributeDetails.riskLevelAssignmentValues,
            parameterAttributeDetails.defaultValue ?? DEFAULT_RISK_VALUE
          ),
        ]
      } else if (parameterAttributeDetails.parameterType == 'ITERABLE') {
        matchedRiskLevels = [
          await getIterableAttributeRiskLevel(
            parameterAttributeDetails,
            entity
          ),
        ]
      }

      matchedRiskLevels.forEach(({ riskValue, value }) =>
        result.push({
          entityType: parameterAttributeDetails.riskEntityType,
          parameter: parameterAttributeDetails.parameter,
          value: value,
          score:
            riskValue.type === 'RISK_LEVEL'
              ? getRiskScoreFromLevel(riskClassificationValues, riskValue.value)
              : riskValue.value,
          riskLevel:
            riskValue.type === 'RISK_LEVEL'
              ? riskValue.value
              : getRiskLevelFromScore(
                  riskClassificationValues,
                  riskValue.value
                ),
          weight: parameterAttributeDetails.weight,
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
    user: User | Business,
    isDrsUpdatable?: boolean
  ): Promise<UserRiskScoreDetails> {
    const { riskFactors, riskClassificationValues } = await this.getRiskConfig()

    const oldKrsScore = (await this.riskRepository.getKrsScore(user.userId))
      ?.krsScore
    const oldDrs = await this.riskRepository.getDrsScore(user.userId)
    const { score: newKrsScore, components } = await this.calculateKrsScore(
      user,
      riskClassificationValues,
      riskFactors || []
    )

    const newRiskData: UserRiskScoreDetails = {
      craRiskLevel: getRiskLevelFromScore(
        riskClassificationValues,
        oldDrs?.drsScore ?? newKrsScore
      ),
      craRiskScore: oldDrs?.drsScore ?? newKrsScore,
      kycRiskLevel: getRiskLevelFromScore(
        riskClassificationValues,
        newKrsScore
      ),
      kycRiskScore: newKrsScore,
    }

    if (newKrsScore === oldKrsScore) {
      // Additional update in case of just locking and unlocking CRA risk level without user details update
      if (
        isDrsUpdatable !== undefined &&
        oldDrs?.isUpdatable !== isDrsUpdatable
      ) {
        await this.riskRepository.createOrUpdateDrsScore(
          user.userId,
          oldDrs?.drsScore ?? newKrsScore,
          'USER_UPDATED',
          components,
          isDrsUpdatable
        )
      }

      return newRiskData
    }
    await this.riskRepository.createOrUpdateKrsScore(
      user.userId,
      newKrsScore,
      components
    )

    if (!oldDrs?.isUpdatable && !isDrsUpdatable) {
      // To override the DRS score lock
      return newRiskData
    }

    const newDRSScore = mean(
      [newKrsScore, oldDrs?.drsScore].filter((v) => v !== null)
    )
    const drsObj = await this.riskRepository.createOrUpdateDrsScore(
      user.userId,
      newDRSScore,
      'USER_UPDATED',
      components,
      isDrsUpdatable
    )

    return {
      craRiskLevel: getRiskLevelFromScore(
        riskClassificationValues,
        newDRSScore
      ),
      craRiskScore: drsObj.drsScore,
      kycRiskLevel: getRiskLevelFromScore(
        riskClassificationValues,
        newKrsScore
      ),
      kycRiskScore: newKrsScore,
    }
  }

  public async backfillUserRiskScores(userIds: string[] = []): Promise<void> {
    const users: FindCursor<User> =
      this.userRepository.getUsersWithoutKrsScoreCursor(userIds)

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
      const getUserOrNull = async (
        userId: string | undefined
      ): Promise<User | Business | null> => {
        if (!userId) {
          return null
        }

        return (
          (await this.userRepository.getUser<User | Business>(userId)) ?? null
        )
      }

      const [originUser, destinationUser] = await Promise.all([
        getUserOrNull(transaction.originUserId),
        getUserOrNull(transaction.destinationUserId),
      ])

      return {
        originUser,
        destinationUser,
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

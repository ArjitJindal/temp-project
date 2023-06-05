import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import _ from 'lodash'
import { FindCursor, MongoClient } from 'mongodb'
import { UserRepository } from '../users/repositories/user-repository'
import { isConsumerUser } from '../rules-engine/utils/user-rule-utils'
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

function getDefaultRiskValue(riskClassificationValues: Array<any>) {
  let riskScore = 75 // Make this configurable
  riskClassificationValues.map((value) => {
    if (value.riskLevel === DEFAULT_RISK_LEVEL) {
      riskScore = _.mean([value.upperBoundRiskScore, value.lowerBoundRiskScore])
    }
  })
  return riskScore
}

function matchParameterValue(
  valueToMatch: unknown,
  parameterValue: RiskParameterValue
): boolean {
  const parameterValueContent = parameterValue.content
  if (
    parameterValueContent.kind === 'LITERAL' &&
    parameterValueContent.content === valueToMatch
  ) {
    return true
  }
  if (
    parameterValueContent.kind === 'MULTIPLE' &&
    parameterValueContent.values.some((x) => x.content === valueToMatch)
  ) {
    return true
  }
  if (parameterValueContent.kind === 'RANGE') {
    if (
      typeof valueToMatch === 'number' &&
      (parameterValueContent.start == null ||
        valueToMatch >= parameterValueContent.start) &&
      (parameterValueContent.end == null ||
        valueToMatch <= parameterValueContent.end)
    ) {
      return true
    }
  }
  if (parameterValueContent.kind === 'TIME_RANGE') {
    // America/Adak (GMT-10:00) Time Zone Example
    const utcOffset = parameterValueContent.timezone.split(' ')[0]
    const timestamp = valueToMatch as number
    const locationTimeHours = dayjs(timestamp).tz(utcOffset).hour()
    if (
      locationTimeHours >= parameterValueContent.startHour &&
      locationTimeHours < parameterValueContent.endHour
    ) {
      return true
    }
  }
  if (parameterValueContent.kind === 'DAY_RANGE') {
    const days = valueToMatch as number
    const start = convertToDays(
      parameterValueContent.start,
      parameterValueContent.startGranularity
    )

    if (parameterValueContent.endGranularity === 'INFINITE' && days >= start) {
      return true
    }

    const end = convertToDays(
      parameterValueContent.end,
      parameterValueContent.endGranularity
    )

    if (days >= start && days <= end) {
      return true
    }
  }

  return false
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
  const iterableValue = _.get(entity, parameter) as unknown as any[]
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
        riskLevelAssignmentValues
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
          riskLevel: DEFAULT_RISK_LEVEL,
        }
  }
  return {
    value: null,
    riskLevel: DEFAULT_RISK_LEVEL,
  }
}

function getDerivedAttributeRiskLevel(
  derivedValue: any,
  riskLevelAssignmentValues: Array<RiskParameterLevelKeyValue>,
  isNullableAllowed: boolean | undefined
): RiskLevel {
  if (derivedValue || isNullableAllowed) {
    for (const { parameterValue, riskLevel } of riskLevelAssignmentValues) {
      if (matchParameterValue(derivedValue, parameterValue)) {
        return riskLevel
      }
    }
  }
  return DEFAULT_RISK_LEVEL
}

function getSchemaAttributeRiskLevel(
  paramName:
    | ParameterAttributeRiskValuesParameterEnum
    | ParameterAttributeRiskValuesTargetIterableParameterEnum,
  entity: User | Business | Transaction,
  riskLevelAssignmentValues: Array<RiskParameterLevelKeyValue>
): {
  value: unknown
  riskLevel: RiskLevel
} {
  let resultValue = null
  let resultRiskLevel: RiskLevel = DEFAULT_RISK_LEVEL
  const endValue = _.get(entity, paramName)
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

export class RiskScoringService {
  tenantId: string
  riskRepository: RiskRepository
  userRepository: UserRepository

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
    })
    this.userRepository = new UserRepository(tenantId, {
      mongoDb: connections.mongoDb,
    })
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
      ['BUSINESS', 'CONSUMER_USER'],
      user,
      riskFactors?.filter(
        ({ riskEntityType }) =>
          riskEntityType === (isUserConsumerUser ? 'CONSUMER_USER' : 'BUSINESS')
      ) || [],
      riskClassificationValues
    )

    return {
      score: components.length
        ? _.mean(components.map(({ score }) => score))
        : getDefaultRiskValue(riskClassificationValues),
      components,
    }
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
        ? _.mean(components.map(({ score }) => score))
        : getDefaultRiskValue(riskClassificationValues),
      components,
    }
  }

  public calculateDrsScore(
    currentDrsScore: number,
    newArsScore: number
  ): number {
    return _.mean([currentDrsScore, newArsScore])
  }

  public async updateInitialRiskScores(user: User | Business): Promise<void> {
    const riskFactors = await this.riskRepository.getParameterRiskItems()
    const riskClassificationValues =
      await this.riskRepository.getRiskClassificationValues()

    const { score, components } = await this.calculateKrsScore(
      user,
      riskClassificationValues,
      riskFactors || []
    )
    await this.riskRepository.createOrUpdateKrsScore(
      user.userId,
      score,
      components
    )
    await this.riskRepository.createOrUpdateDrsScore(
      user.userId,
      score,
      'FIRST_DRS',
      components
    )
  }

  public async updateDynamicRiskScores(transaction: Transaction): Promise<{
    originDrsScore: number | undefined | null
    destinationDrsScore: number | undefined | null
  }> {
    const riskFactors = await this.riskRepository.getParameterRiskItems()
    const riskClassificationValues =
      await this.riskRepository.getRiskClassificationValues()
    const { score: arsScore, components } = await this.calculateArsScore(
      transaction,
      riskClassificationValues,
      riskFactors || []
    )

    await this.riskRepository.createOrUpdateArsScore(
      transaction.transactionId,
      arsScore,
      transaction.originUserId,
      transaction.destinationUserId,
      components
    )

    let originDrsScore = null
    let destinationDrsScore = null

    if (transaction.originUserId) {
      originDrsScore = await this.calculateAndUpdateDRS(
        transaction.originUserId,
        arsScore,
        transaction.transactionId,
        components
      )
    }
    if (transaction.destinationUserId) {
      destinationDrsScore = await this.calculateAndUpdateDRS(
        transaction.destinationUserId,
        arsScore,
        transaction.transactionId!,
        components
      )
    }

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
            parameterAttributeDetails.parameter
          )
        }
        matchedRiskLevels = derivedValues.map((derivedValue) => ({
          value: derivedValue,
          riskLevel: getDerivedAttributeRiskLevel(
            derivedValue,
            parameterAttributeDetails.riskLevelAssignmentValues,
            parameterAttributeDetails.isNullableAllowed
          ),
        }))
      } else if (parameterAttributeDetails.parameterType == 'VARIABLE') {
        matchedRiskLevels = [
          getSchemaAttributeRiskLevel(
            parameterAttributeDetails.parameter,
            entity,
            parameterAttributeDetails.riskLevelAssignmentValues
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

  public async backfillUserRiskScores(): Promise<void> {
    const users: FindCursor<User> =
      await this.userRepository.getUsersWithoutKrsScoreCursor()

    for await (const user of users) {
      if (!user) {
        continue
      }
      await this.updateInitialRiskScores(user)
    }
  }

  getUsersFromTransaction = _.memoize(
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
}

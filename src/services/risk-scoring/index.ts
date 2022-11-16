import _ from 'lodash'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { UserRepository } from '../users/repositories/user-repository'
import { RiskRepository } from './repositories/risk-repository'
import {
  DEFAULT_RISK_LEVEL,
  getAgeFromTimestamp,
  riskLevelPrecendence,
} from './utils'
import { ParameterAttributeRiskValues } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { logger } from '@/core/logger'
import { RiskParameterLevelKeyValue } from '@/@types/openapi-internal/RiskParameterLevelKeyValue'
import dayjs from '@/utils/dayjs'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'

const getDefaultRiskValue = (riskClassificationValues: Array<any>) => {
  let riskScore = 75 // Make this configurable
  riskClassificationValues.map((value) => {
    if (value.riskLevel === DEFAULT_RISK_LEVEL) {
      riskScore = _.mean([value.upperBoundRiskScore, value.lowerBoundRiskScore])
    }
  })
  return riskScore
}

export const updateInitialRiskScores = async (
  tenantId: string,
  dynamoDb: DynamoDBDocumentClient,
  user: User | Business
): Promise<any> => {
  const riskRepository = new RiskRepository(tenantId, { dynamoDb })
  const parameterRiskScores = await riskRepository.getParameterRiskItems()
  const riskClassificationValues = await riskRepository.getRiskClassification()
  const riskScoresList: number[] = []
  parameterRiskScores
    ?.filter(
      (parameterAttributeDetails) =>
        parameterAttributeDetails.isActive &&
        parameterAttributeDetails.riskScoreType === 'KRS'
    )
    .forEach((parameterAttributeDetails) => {
      if (parameterAttributeDetails.isDerived) {
        if (
          parameterAttributeDetails.parameter ===
            'legalEntity.companyRegistrationDetails.dateOfRegistration' ||
          parameterAttributeDetails.parameter === 'userDetails.dateOfBirth'
        ) {
          const riskLevel = getAgeDerivedRiskLevel(
            parameterAttributeDetails.parameter,
            user,
            parameterAttributeDetails.riskLevelAssignmentValues
          )
          riskScoresList.push(getRiskScore(riskClassificationValues, riskLevel))
        }
      } else if (parameterAttributeDetails.parameterType == 'VARIABLE') {
        const riskLevel: RiskLevel = getSchemaAttributeRiskLevel(
          parameterAttributeDetails.parameter,
          user,
          parameterAttributeDetails.riskLevelAssignmentValues
        )
        riskScoresList.push(getRiskScore(riskClassificationValues, riskLevel))
      } else if (parameterAttributeDetails.parameterType == 'ITERABLE') {
        const riskLevel: RiskLevel = getIterableAttributeRiskLevel(
          parameterAttributeDetails,
          user
        )
        riskScoresList.push(getRiskScore(riskClassificationValues, riskLevel))
      }
    })

  logger.info(`Risk scores: ${riskScoresList}`)

  const krsScore = riskScoresList.length
    ? _.mean(riskScoresList)
    : getDefaultRiskValue(riskClassificationValues)

  logger.info(`KRS Score: ${krsScore}`)
  await riskRepository.createOrUpdateKrsScore(user.userId, krsScore)
  await riskRepository.createOrUpdateDrsScore(
    user.userId,
    krsScore,
    'FIRST_DRS'
  )
}

export const updateDynamicRiskScores = async (
  tenantId: string,
  dynamoDb: DynamoDBDocumentClient,
  transaction: Transaction
): Promise<any> => {
  const riskRepository = new RiskRepository(tenantId, { dynamoDb })
  const userRepository = new UserRepository(tenantId, { dynamoDb })
  const parameterRiskScores = await riskRepository.getParameterRiskItems()
  const riskClassificationValues = await riskRepository.getRiskClassification()
  const riskScoresList: number[] = []

  const relevantParameters =
    parameterRiskScores?.filter(
      (parameterAttributeDetails) =>
        parameterAttributeDetails.isActive &&
        parameterAttributeDetails.riskScoreType === 'ARS'
    ) ?? []

  for (const parameterAttributeDetails of relevantParameters) {
    if (parameterAttributeDetails.isDerived) {
      if (parameterAttributeDetails.riskEntityType === 'CONSUMER_USER') {
        if (parameterAttributeDetails.parameter === 'createdTimestamp') {
          const users = await getUsersFromTransaction(
            transaction,
            userRepository
          )
          if (users.length) {
            users.map((user) => {
              const riskLevel = getAgeDerivedRiskLevel(
                parameterAttributeDetails.parameter,
                user,
                parameterAttributeDetails.riskLevelAssignmentValues
              )
              riskScoresList.push(
                getRiskScore(riskClassificationValues, riskLevel)
              )
            })
          }
        }
      }
    } else if (parameterAttributeDetails.riskEntityType === 'TRANSACTION') {
      const riskLevel: RiskLevel = getSchemaAttributeRiskLevel(
        parameterAttributeDetails.parameter,
        transaction,
        parameterAttributeDetails.riskLevelAssignmentValues
      )
      riskScoresList.push(getRiskScore(riskClassificationValues, riskLevel))
    }
  }
  const arsScore = riskScoresList.length
    ? _.mean(riskScoresList)
    : getDefaultRiskValue(riskClassificationValues)

  logger.info(`ARS Scores List: ${riskScoresList}`)
  logger.info(`ARS Score: ${arsScore}`)

  await riskRepository.createOrUpdateArsScore(
    transaction.transactionId!,
    arsScore,
    transaction.originUserId,
    transaction.destinationUserId
  )
  if (transaction.originUserId) {
    await calculateAndUpdateDRS(
      transaction.originUserId,
      arsScore,
      transaction.transactionId!,
      riskRepository
    )
  }
  if (transaction.destinationUserId) {
    await calculateAndUpdateDRS(
      transaction.destinationUserId,
      arsScore,
      transaction.transactionId!,
      riskRepository
    )
  }
}

const calculateAndUpdateDRS = async (
  userId: string,
  arsScore: number,
  transactionId: string,
  riskRepository: RiskRepository
) => {
  const krsScore = (await riskRepository.getKrsScore(userId))?.krsScore
  if (krsScore == null) {
    return
  }

  const currentDrsValue =
    (await riskRepository.getDrsScore(userId))?.drsValue ?? krsScore

  const drsScore = _.mean([currentDrsValue, krsScore, arsScore])
  await riskRepository.createOrUpdateDrsScore(userId, drsScore, transactionId!)
}

const getUsersFromTransaction = async (
  transaction: Transaction,
  userRepository: UserRepository
) => {
  const userIds = []
  if (transaction.originUserId) {
    userIds.push(transaction.originUserId)
  }
  if (transaction.destinationUserId) {
    userIds.push(transaction.destinationUserId)
  }
  return await userRepository.getUsers(userIds)
}

export const matchParameterValue = (
  valueToMatch: unknown,
  parameterValue: RiskParameterValue
): boolean => {
  const parameterValueContent = parameterValue.content
  if (
    parameterValueContent.kind === 'LITERAL' &&
    parameterValueContent === valueToMatch
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
  return false
}

const getSchemaAttributeRiskLevel = (
  paramName: string,
  entity: User | Business | Transaction,
  riskLevelAssignmentValues: Array<RiskParameterLevelKeyValue>
): RiskLevel => {
  const endValue = _.get(entity, paramName)

  if (endValue) {
    for (const { parameterValue, riskLevel } of riskLevelAssignmentValues) {
      if (matchParameterValue(endValue, parameterValue)) {
        return riskLevel
      }
    }
  }
  return DEFAULT_RISK_LEVEL
}

const getIterableAttributeRiskLevel = (
  parameterAttributeDetails: ParameterAttributeRiskValues,
  user: User | Business
): RiskLevel => {
  const {
    parameter,
    targetIterableParameter,
    matchType,
    riskLevelAssignmentValues,
  } = parameterAttributeDetails
  const iterableValue = _.get(user, parameter)
  let individualRiskLevel
  let iterableMaxRiskLevel = 'VERY_LOW' as RiskLevel
  if (iterableValue && targetIterableParameter) {
    iterableValue.forEach((value: any) => {
      individualRiskLevel = getSchemaAttributeRiskLevel(
        targetIterableParameter,
        value,
        riskLevelAssignmentValues
      )
      if (
        riskLevelPrecendence[individualRiskLevel] >=
        riskLevelPrecendence[iterableMaxRiskLevel]
      ) {
        iterableMaxRiskLevel = individualRiskLevel
      }
    })
    return iterableMaxRiskLevel
  } else if (
    iterableValue &&
    !targetIterableParameter &&
    matchType == 'ARRAY_MATCH'
  ) {
    let hasRiskValueMatch = false
    iterableValue.forEach((value: any) => {
      const { riskLevelAssignmentValues } = parameterAttributeDetails
      for (const riskLevelAssignmentValue of riskLevelAssignmentValues) {
        if (
          matchParameterValue(value, riskLevelAssignmentValue.parameterValue)
        ) {
          if (
            riskLevelPrecendence[riskLevelAssignmentValue.riskLevel] >=
            riskLevelPrecendence[iterableMaxRiskLevel]
          ) {
            iterableMaxRiskLevel = riskLevelAssignmentValue.riskLevel
            hasRiskValueMatch = true
          }
        }
      }
    })
    return hasRiskValueMatch ? iterableMaxRiskLevel : DEFAULT_RISK_LEVEL
  }
  return DEFAULT_RISK_LEVEL
}

const getAgeDerivedRiskLevel = (
  paramName: string,
  entity: User | Business,
  riskLevelAssignmentValues: Array<RiskParameterLevelKeyValue>
) => {
  const endValue = _.get(entity, paramName)
  if (endValue) {
    const age = getAgeFromTimestamp(dayjs(endValue).valueOf())
    for (const { parameterValue, riskLevel } of riskLevelAssignmentValues) {
      if (matchParameterValue(age, parameterValue)) {
        return riskLevel
      }
    }
  }
  return DEFAULT_RISK_LEVEL
}

const getRiskScore = (
  riskClassificationValues: Array<any>,
  riskLevel: RiskLevel
): number => {
  let calculatedRiskScore = 75
  riskClassificationValues.forEach((value) => {
    if (riskLevel == value.riskLevel) {
      calculatedRiskScore = _.mean([
        value.upperBoundRiskScore,
        value.lowerBoundRiskScore,
      ])
    }
  })
  return calculatedRiskScore
}

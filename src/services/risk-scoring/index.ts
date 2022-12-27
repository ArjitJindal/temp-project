import _ from 'lodash'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { UserRepository } from '../users/repositories/user-repository'
import { isConsumerUser } from '../rules-engine/utils/user-rule-utils'
import { RiskRepository } from './repositories/risk-repository'
import {
  DEFAULT_RISK_LEVEL,
  getAgeFromTimestamp,
  getAgeInDaysFromTimestamp,
  getRiskScoreFromLevel,
  riskLevelPrecendence,
} from './utils'
import {
  ParameterAttributeRiskValues,
  ParameterAttributeRiskValuesParameterEnum,
  ParameterAttributeRiskValuesTargetIterableParameterEnum,
} from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { logger } from '@/core/logger'
import { RiskParameterLevelKeyValue } from '@/@types/openapi-internal/RiskParameterLevelKeyValue'
import dayjs from '@/utils/dayjs'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { RiskParameterValue } from '@/@types/openapi-internal/RiskParameterValue'
import { PulseAuditLogService } from '@/lambdas/console-api-pulse/services/pulse-audit-log'
import { CASES_COLLECTION } from '@/utils/mongoDBUtils'
import { Case } from '@/@types/openapi-internal/Case'

const DOMESTIC_FOREIGN_PARAMETERS: ParameterAttributeRiskValuesParameterEnum[] =
  [
    'domesticOrForeignOriginCountryConsumer',
    'domesticOrForeignOriginCountryBusiness',
    'domesticOrForeignDestinationCountryConsumer',
    'domesticOrForeignDestinationCountryBusiness',
  ]

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
  const riskClassificationValues =
    await riskRepository.getRiskClassificationValues()
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
          riskScoresList.push(
            getRiskScoreFromLevel(riskClassificationValues, riskLevel)
          )
        }
      } else if (parameterAttributeDetails.parameterType == 'VARIABLE') {
        const riskLevel: RiskLevel = getSchemaAttributeRiskLevel(
          parameterAttributeDetails.parameter,
          user,
          parameterAttributeDetails.riskLevelAssignmentValues
        )
        riskScoresList.push(
          getRiskScoreFromLevel(riskClassificationValues, riskLevel)
        )
      } else if (parameterAttributeDetails.parameterType == 'ITERABLE') {
        const riskLevel: RiskLevel = getIterableAttributeRiskLevel(
          parameterAttributeDetails,
          user
        )
        riskScoresList.push(
          getRiskScoreFromLevel(riskClassificationValues, riskLevel)
        )
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
): Promise<{
  originDrsScore: number | undefined | null
  destinationDrsScore: number | undefined | null
}> => {
  const riskRepository = new RiskRepository(tenantId, { dynamoDb })
  const userRepository = new UserRepository(tenantId, { dynamoDb })
  const parameterRiskScores = await riskRepository.getParameterRiskItems()
  const riskClassificationValues =
    await riskRepository.getRiskClassificationValues()
  const riskScoresList: number[] = []
  const users = await getUsersFromTransaction(transaction, userRepository)

  const relevantParameters =
    parameterRiskScores?.filter(
      (parameterAttributeDetails) =>
        parameterAttributeDetails.isActive &&
        parameterAttributeDetails.riskScoreType === 'ARS'
    ) ?? []

  for (const parameterAttributeDetails of relevantParameters) {
    if (parameterAttributeDetails.riskEntityType === 'TRANSACTION') {
      if (parameterAttributeDetails.parameter === 'createdTimestamp') {
        if (users.length) {
          users.forEach((user) => {
            const riskLevel = getAgeDerivedRiskLevel(
              parameterAttributeDetails.parameter,
              user,
              parameterAttributeDetails.riskLevelAssignmentValues,
              'DAY'
            )
            riskScoresList.push(
              getRiskScoreFromLevel(riskClassificationValues, riskLevel)
            )
          })
        }
      }
      if (parameterAttributeDetails.isDerived) {
        if (
          DOMESTIC_FOREIGN_PARAMETERS.includes(
            parameterAttributeDetails.parameter
          )
        ) {
          users.forEach((user) => {
            const riskLevel: RiskLevel | undefined = getCountryDerivedRiskLevel(
              transaction,
              user,
              parameterAttributeDetails.parameter,
              parameterAttributeDetails.riskLevelAssignmentValues
            )
            if (riskLevel) {
              riskScoresList.push(
                getRiskScoreFromLevel(riskClassificationValues, riskLevel)
              )
            }
          })
        }
      } else {
        const riskLevel: RiskLevel = getSchemaAttributeRiskLevel(
          parameterAttributeDetails.parameter,
          transaction,
          parameterAttributeDetails.riskLevelAssignmentValues
        )
        riskScoresList.push(
          getRiskScoreFromLevel(riskClassificationValues, riskLevel)
        )
      }
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

  let originDrsScore = null
  let destinationDrsScore = null

  if (transaction.originUserId) {
    originDrsScore = await calculateAndUpdateDRS(
      transaction.originUserId,
      arsScore,
      transaction.transactionId!,
      riskRepository
    )
  }
  if (transaction.destinationUserId) {
    destinationDrsScore = await calculateAndUpdateDRS(
      transaction.destinationUserId,
      arsScore,
      transaction.transactionId!,
      riskRepository
    )
  }

  return { originDrsScore, destinationDrsScore }
}

const calculateAndUpdateDRS = async (
  userId: string,
  arsScore: number,
  transactionId: string,
  riskRepository: RiskRepository
): Promise<number | null | undefined> => {
  const krsScore = (await riskRepository.getKrsScore(userId))?.krsScore
  if (krsScore == null) {
    return null
  }

  const drsObject = await riskRepository.getDrsScore(userId)
  const currentDrsValue = drsObject?.drsScore ?? krsScore

  if (!drsObject?.isUpdatable) {
    return drsObject?.drsScore
  }
  const auditLogService = new PulseAuditLogService(riskRepository.tenantId)
  const drsScore = _.mean([currentDrsValue, krsScore, arsScore])
  await riskRepository.createOrUpdateDrsScore(userId, drsScore, transactionId!)
  const newDrsObject = await riskRepository.getDrsScore(userId)
  await auditLogService.handleDrsUpdate(drsObject, newDrsObject, 'AUTOMATIC')

  return newDrsObject?.drsScore
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
  if (
    parameterValueContent.kind === 'RANGE' ||
    parameterValueContent.kind === 'DAY_RANGE'
  ) {
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

  return false
}

const getSchemaAttributeRiskLevel = (
  paramName:
    | ParameterAttributeRiskValuesParameterEnum
    | ParameterAttributeRiskValuesTargetIterableParameterEnum,
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
  paramName: ParameterAttributeRiskValuesParameterEnum,
  entity: User | Business,
  riskLevelAssignmentValues: Array<RiskParameterLevelKeyValue>,
  granularity = 'YEAR'
) => {
  const endValue = _.get(entity, paramName)
  if (endValue) {
    const age =
      granularity === 'YEAR'
        ? getAgeFromTimestamp(dayjs(endValue).valueOf())
        : getAgeInDaysFromTimestamp(dayjs(endValue).valueOf())
    for (const { parameterValue, riskLevel } of riskLevelAssignmentValues) {
      if (matchParameterValue(age, parameterValue)) {
        return riskLevel
      }
    }
  }
  return DEFAULT_RISK_LEVEL
}

const getCountryDerivedRiskLevel = (
  transaction: Transaction,
  user: User | Business,
  paramName: ParameterAttributeRiskValuesParameterEnum,
  riskLevelAssignmentValues: Array<RiskParameterLevelKeyValue>
) => {
  const transactionCountry =
    paramName === 'domesticOrForeignOriginCountryBusiness' ||
    paramName === 'domesticOrForeignOriginCountryConsumer'
      ? _.get(transaction, 'originAmountDetails.country')
      : _.get(transaction, 'destinationAmountDetails.country')
  const isConsumer = isConsumerUser(user)
  const userMatchParam =
    (isConsumer &&
      (paramName === 'domesticOrForeignOriginCountryConsumer' ||
        paramName === 'domesticOrForeignDestinationCountryConsumer')) ||
    (!isConsumer &&
      (paramName === 'domesticOrForeignOriginCountryBusiness' ||
        paramName === 'domesticOrForeignDestinationCountryBusiness'))
  if (!userMatchParam) {
    return
  }

  const userCountry = isConsumer
    ? _.get(user, 'userDetails.countryOfResidence')
    : _.get(user, 'legalEntity.companyRegistrationDetails.registrationCountry')
  for (const { parameterValue, riskLevel } of riskLevelAssignmentValues) {
    // If any of transaction/user country is missing, default to FOREIGN
    const riskValue =
      transactionCountry && userCountry && transactionCountry === userCountry
        ? 'DOMESTIC'
        : 'FOREIGN'
    if (matchParameterValue(riskValue, parameterValue)) {
      return riskLevel
    }
  }
  return DEFAULT_RISK_LEVEL
}

export const updateDynamicRiskScoresInCases = async (
  transactionId: Transaction['transactionId'],
  mongoDb: MongoClient,
  tenantId: string,
  originDrsScore: number | undefined | null,
  destinationDrsScore: number | undefined | null
): Promise<void> => {
  const caseTable = CASES_COLLECTION(tenantId)
  const db = mongoDb.db()
  const collection = db.collection<Case>(caseTable)
  await collection.updateOne(
    { caseTransactionsIds: { $elemMatch: { $eq: transactionId } } },
    {
      $set: {
        'caseUsers.originUserDrsScore': originDrsScore,
        'caseUsers.destinationUserDrsScore': destinationDrsScore,
      },
    }
  )
}

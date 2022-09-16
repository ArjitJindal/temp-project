import _ from 'lodash'
import { RiskRepository } from './repositories/risk-repository'
import { ParameterAttributeRiskValues } from '@/@types/openapi-internal/ParameterAttributeRiskValues'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'

const DEFAULT_RISK_LEVEL = 'HIGH' // defaults to high risk for now - will be configurable in the future

export const calculateKRS = async (
  tenantId: string,
  dynamoDb: AWS.DynamoDB.DocumentClient,
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
        !parameterAttributeDetails.isDerived &&
        parameterAttributeDetails.riskEntityType === 'CONSUMER_USER'
    )
    .forEach((parameterAttributeDetails) => {
      const riskLevel: RiskLevel = getSchemaAttributeValues(
        parameterAttributeDetails.parameter,
        user,
        parameterAttributeDetails
      )
      riskClassificationValues.map((value) => {
        if (riskLevel == value.riskLevel) {
          const riskScore = _.mean([
            value.upperBoundRiskScore,
            value.lowerBoundRiskScore,
          ])
          riskScoresList.push(riskScore)
        }
      })
    })
  const krsScore = _.mean(riskScoresList)
  await riskRepository.createOrUpdateKrsScore(user.userId, krsScore)
}

const getSchemaAttributeValues = (
  paramName: string,
  user: User | Business,
  parameterRiskLevelDetails: ParameterAttributeRiskValues
): RiskLevel => {
  const endValue = _.get(user, paramName)

  if (endValue) {
    const { riskLevelAssignmentValues } = parameterRiskLevelDetails
    for (const idx in riskLevelAssignmentValues) {
      if (riskLevelAssignmentValues[idx].parameterValue === endValue) {
        return riskLevelAssignmentValues[idx].riskLevel
      }
    }
  }
  return DEFAULT_RISK_LEVEL
}

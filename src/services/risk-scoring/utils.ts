import _ from 'lodash'
import dayjs from '@/utils/dayjs'
import { RiskLevel } from '@/@types/openapi-public/RiskLevel'

type OptionRequirements = Record<RiskLevel, number>

export const riskLevelPrecendence: OptionRequirements = {
  VERY_LOW: 1,
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
  VERY_HIGH: 5,
}
export const DEFAULT_RISK_LEVEL = 'VERY_HIGH' // defaults to very high risk for now - will be configurable in the future

export const getRiskLevelFromScore = (
  riskClassificationValues: Array<any>,
  riskScore: number | null
): RiskLevel => {
  if (riskScore === null) {
    return DEFAULT_RISK_LEVEL
  }

  let riskLevel: RiskLevel | undefined
  riskClassificationValues.map((value) => {
    if (
      riskScore >= value.lowerBoundRiskScore &&
      riskScore < value.upperBoundRiskScore
    ) {
      riskLevel = value.riskLevel
    }
  })
  return riskLevel ? riskLevel : DEFAULT_RISK_LEVEL
}

export const getAgeFromTimestamp = (timestamp: number) => {
  return dayjs().diff(dayjs(timestamp), 'year')
}

export const getRiskScoreFromLevel = (
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

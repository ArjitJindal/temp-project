import dayjs from '@/utils/dayjs'
import { RiskLevel } from '@/@types/openapi-public/RiskLevel'
import { RiskScoreComponent } from '@/@types/openapi-internal/RiskScoreComponent'
import { RiskScoreValueLevel } from '@/@types/openapi-internal/RiskScoreValueLevel'

type OptionRequirements = Record<RiskLevel, number>

export const riskLevelPrecendence: OptionRequirements = {
  VERY_LOW: 1,
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
  VERY_HIGH: 5,
}
export const DEFAULT_RISK_LEVEL = 'VERY_HIGH' // defaults to very high risk for now - will be configurable in the future

export const DEFAULT_RISK_VALUE: RiskScoreValueLevel = {
  type: 'RISK_LEVEL',
  value: DEFAULT_RISK_LEVEL,
}

export const getAgeFromTimestamp = (timestamp: number) => {
  return dayjs().diff(dayjs(timestamp), 'year')
}

export const getAgeInDaysFromTimestamp = (timestamp: number) => {
  return dayjs().diff(dayjs(timestamp), 'day')
}

export const getRiskScoreBoundsFromLevel = (
  riskClassificationValues: Array<any>,
  riskLevel: RiskLevel
): { lowerBoundRiskScore: number; upperBoundRiskScore: number } => {
  let lowerBoundRiskScore = 0
  let upperBoundRiskScore = 0
  riskClassificationValues.forEach((value) => {
    if (riskLevel == value.riskLevel) {
      lowerBoundRiskScore = value.lowerBoundRiskScore
      upperBoundRiskScore = value.upperBoundRiskScore
    }
  })
  return { lowerBoundRiskScore, upperBoundRiskScore }
}

export const weightedRiskScoreCalculation = (
  riskScores: RiskScoreComponent[]
) => {
  // (riskScore1 * weight1 + riskScore2 * weight2 + ... + riskScoreN * weightN) / (weight1 + weight2 + ... + weightN)
  let weightedRiskScore = 0
  let totalWeight = 0

  riskScores.forEach((riskScore) => {
    weightedRiskScore += riskScore.score * riskScore.weight
    totalWeight += riskScore.weight
  })

  return weightedRiskScore / totalWeight
}

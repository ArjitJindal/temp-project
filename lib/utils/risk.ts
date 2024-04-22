import { mean } from 'lodash'

type RiskLevel = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'

type RiskClassificationScore = {
  riskLevel: RiskLevel
  lowerBoundRiskScore: number
  upperBoundRiskScore: number
}

export const DEFAULT_RISK_LEVEL: RiskLevel = 'VERY_HIGH'

export const getRiskLevelFromScore = (
  riskClassificationValues: Array<RiskClassificationScore>,
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

export const getRiskScoreFromLevel = (
  riskClassificationValues: Array<RiskClassificationScore>,
  riskLevel: RiskLevel
): number => {
  let calculatedRiskScore = 75

  riskClassificationValues.forEach((value) => {
    if (riskLevel == value.riskLevel) {
      calculatedRiskScore = mean([
        value.upperBoundRiskScore,
        value.lowerBoundRiskScore,
      ])
    }
  })

  return calculatedRiskScore
}

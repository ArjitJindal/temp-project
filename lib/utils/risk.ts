import mean from 'lodash/mean'

type RiskLevel = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'

type RiskClassificationScore = {
  riskLevel: RiskLevel
  lowerBoundRiskScore: number
  upperBoundRiskScore: number
}

type RiskLevelAlias = {
  level: RiskLevel
  alias: string
  isActive: boolean
}

export const DEFAULT_RISK_LEVEL: RiskLevel = 'VERY_HIGH'

export const DEFAULT_RISK_VALUE = {
  type: 'RISK_LEVEL',
  value: DEFAULT_RISK_LEVEL,
}

export const DRS_CHANGE_PSEUDO_TX_IDS = [
  'USER_UPDATED',
  'FIRST_DRS',
  'MANUAL_UPDATE',
  'USER_UPDATE',
  'RISK_SCORING_RERUN',
]

export function isNotArsChangeTxId(transactionId?: string) {
  return DRS_CHANGE_PSEUDO_TX_IDS.includes(transactionId ?? '')
}

export function isManualDrsTxId(transactionId: string) {
  return transactionId === 'MANUAL_UPDATE'
}

export const getRiskLevelFromScore = (
  riskClassificationValues: Array<RiskClassificationScore>,
  riskScore: number | null,
  riskSettings?: Array<RiskLevelAlias>
): RiskLevel => {
  if (riskScore === null) {
    return DEFAULT_RISK_LEVEL
  }

  let riskLevel: RiskLevel | undefined

  const isLevelActive = (level: RiskLevel): boolean => {
    const setting = riskSettings?.find((s) => s.level === level)
    return setting?.isActive ?? true
  }

  const activeLevels = riskClassificationValues.filter((v) =>
    isLevelActive(v.riskLevel)
  )

  for (let i = 0; i < riskClassificationValues.length; i++) {
    const value = riskClassificationValues[i]
    const active = isLevelActive(value.riskLevel)

    const isLastActive =
      activeLevels[activeLevels.length - 1]?.riskLevel === value.riskLevel

    const withinRange =
      riskScore >= value.lowerBoundRiskScore &&
      (isLastActive
        ? riskScore <= value.upperBoundRiskScore
        : riskScore < value.upperBoundRiskScore)

    if (active && withinRange) {
      riskLevel = value.riskLevel
      break
    }
  }

  if (!riskLevel) {
    const lastActive = activeLevels[activeLevels.length - 1]
    if (lastActive && riskScore >= lastActive.upperBoundRiskScore) {
      riskLevel = lastActive.riskLevel
    }
  }

  return riskLevel ?? DEFAULT_RISK_LEVEL
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

import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { RuleStage } from '@/@types/openapi-internal/RuleStage'

export function isConsumerUser(user: User | Business): user is User {
  return !isBusinessUser(user)
}

export function isBusinessUser(user: User | Business): user is Business {
  return (user as Business).legalEntity !== undefined
}

export function isOngoingUserRuleInstance(
  ruleInstance: RuleInstance,
  isRiskLevelsEnabled: boolean
) {
  const schedule = ruleInstance.userRuleRunCondition?.schedule
  if (schedule) {
    return true
  }

  const checkForOngoing = (parameters: {
    ongoingScreening?: boolean
    ruleStages?: RuleStage[]
  }) =>
    Boolean(
      parameters?.ongoingScreening || parameters.ruleStages?.includes('ONGOING')
    )

  if (isRiskLevelsEnabled && ruleInstance.riskLevelParameters) {
    return Boolean(
      Object.values(ruleInstance.riskLevelParameters).find(checkForOngoing)
    )
  }
  return checkForOngoing(ruleInstance.parameters)
}

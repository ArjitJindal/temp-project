import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'

export function isConsumerUser(user: User | Business) {
  return !isBusinessUser(user)
}

export function isBusinessUser(user: User | Business) {
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

  if (isRiskLevelsEnabled && ruleInstance.riskLevelParameters) {
    return Boolean(
      Object.values(ruleInstance.riskLevelParameters).find(
        (parameters) => parameters?.ongoingScreening
      )
    )
  }
  return Boolean(ruleInstance.parameters?.ongoingScreening)
}

import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { RuleNature } from '@/@types/openapi-internal/RuleNature'

export function isConsumerUser(user: User | Business): user is User {
  return !isBusinessUser(user)
}

export function isBusinessUser(user: User | Business): user is Business {
  return (user as Business).legalEntity !== undefined
}

export function isOngoingUserRuleInstance(
  ruleInstance: RuleInstance,
  isRiskLevelsEnabled: boolean,
  ruleNature?: RuleNature
) {
  const schedule = ruleInstance.userRuleRunCondition?.schedule
  if (schedule && (!ruleNature || ruleNature === ruleInstance.nature)) {
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

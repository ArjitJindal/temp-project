import { migrateRuleInstance } from '../utils/rule'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'

export const up = async () => {
  await migrateRuleInstance(
    'R-75',
    'R-2',
    (ruleInstance: RuleInstance) => ruleInstance
  )
}
export const down = async () => {
  // skip
}

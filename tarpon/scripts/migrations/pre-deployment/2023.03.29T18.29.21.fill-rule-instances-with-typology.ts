import { migrateAllTenants } from '../utils/tenant'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = await getDynamoDbClient()
  const rulesRepository = new RuleRepository(tenant.id, {
    dynamoDb,
  })
  const rules = await rulesRepository.getAllRules()
  const ruleInstacneRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })

  const ruleInstances = await ruleInstacneRepository.getAllRuleInstances()

  for (const ruleInstance of ruleInstances) {
    const rule = rules.find((rule) => rule.id === ruleInstance.ruleId)
    if (rule) {
      ruleInstance.typology = rule.typology
      ruleInstance.typologyGroup = rule.typologyGroup
      ruleInstance.typologyDescription = rule.typologyDescription
      ruleInstance.source = rule.source
      await ruleInstacneRepository.createOrUpdateRuleInstance(ruleInstance)
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

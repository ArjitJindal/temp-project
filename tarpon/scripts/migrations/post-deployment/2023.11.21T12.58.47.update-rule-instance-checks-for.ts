import { migrateAllTenants } from '../utils/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { RuleService } from '@/services/rules-engine'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const ruleRepository = new RuleRepository(tenant.id, {
    dynamoDb,
  })

  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()

  for (const ruleInstance of ruleInstances) {
    if (ruleInstance.checksFor) {
      continue
    }

    const rule = await ruleRepository.getRuleById(ruleInstance.ruleId)
    if (!rule) {
      throw new Error(`Rule ${ruleInstance.ruleId} not found`)
    }
    const checksFor = rule.checksFor

    await ruleInstanceRepository.createOrUpdateRuleInstance({
      ...ruleInstance,
      checksFor,
    })
  }
}

export const up = async () => {
  await RuleService.syncRulesLibrary()
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

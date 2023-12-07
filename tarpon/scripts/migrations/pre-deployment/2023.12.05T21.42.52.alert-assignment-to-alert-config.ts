import { migrateAllTenants } from '../utils/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()
  for (const ruleInstance of ruleInstances) {
    await ruleInstanceRepository.createOrUpdateRuleInstance({
      alertConfig: {
        alertCreationInterval:
          ruleInstance['alertCreationInterval'] ??
          ruleInstance.alertConfig?.alertCreationInterval,
      },
    } as RuleInstance)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

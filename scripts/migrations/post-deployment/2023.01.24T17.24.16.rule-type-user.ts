import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/@types/openapi-internal/Tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getTransactionRuleByRuleId } from '@/services/rules-engine/transaction-rules/library'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = await getDynamoDbClient()

  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })

  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()

  for (const ruleInstance of ruleInstances) {
    const rule = getTransactionRuleByRuleId(ruleInstance.ruleId)

    if (!rule) {
      console.warn(`Rule not found - ${ruleInstance.ruleId}. Skip.`)
      continue
    }

    await ruleInstanceRepository.createOrUpdateRuleInstance({
      ...ruleInstance,
      caseCreationType: 'USER',
    })

    console.log(
      `Updated rule case creation type - ${ruleInstance.ruleId} (${ruleInstance.id})`
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

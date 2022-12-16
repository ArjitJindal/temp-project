import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/lambdas/console-api-account/services/accounts-service'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getTransactionRuleByRuleId } from '@/services/rules-engine/transaction-rules/library'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = await getDynamoDbClient()

  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })

  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()

  for (const ruleInstance of ruleInstances) {
    const { nature } = ruleInstance
    if (nature) {
      continue
    }
    const rule = getTransactionRuleByRuleId(ruleInstance.ruleId)

    if (!rule) {
      throw new Error(`Rule not found - ${ruleInstance.ruleId}`)
    }
    const { defaultNature: ruleNature } = rule
    if (!ruleNature) {
      throw new Error(`Rule nature not found - ${ruleInstance.ruleId}`)
    }
    await ruleInstanceRepository.createOrUpdateRuleInstance({
      ...ruleInstance,
      nature: ruleNature,
    })

    console.log(
      `Updated rule instance nature - ${ruleInstance.ruleId} (${ruleInstance.id})`
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/@types/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const rulesRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const activeRuleInstances = await rulesRepository.getActiveRuleInstances()
  const deletedRuleInstances = activeRuleInstances.filter(
    (ruleInstance) => ruleInstance.ruleId === 'R-16'
  )
  for (const ruleInstance of deletedRuleInstances) {
    await rulesRepository.createOrUpdateRuleInstance(
      {
        ...ruleInstance,
        status: 'INACTIVE',
      },
      Date.now()
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

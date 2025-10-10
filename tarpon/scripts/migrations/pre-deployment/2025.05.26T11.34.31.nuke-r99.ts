import { migrateAllTenants } from '../utils/tenant'
import { deleteRules } from '../utils/rule'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/@types/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()
  const r99Instances = ruleInstances.filter(
    (instance) => instance.ruleId === 'R-99'
  )
  for (const instance of r99Instances) {
    if (instance.id) {
      await ruleInstanceRepository.deleteRuleInstance(instance.id)
    }
  }
}

export const up = async () => {
  await deleteRules(['R-99'])
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

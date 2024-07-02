import { migrateAllTenants } from '../utils/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const repo = new RuleInstanceRepository(tenant.id, { dynamoDb })
  const ruleInstances = await repo.getAllRuleInstances()
  for (const ruleInstance of ruleInstances) {
    if (
      ruleInstance.logicEntityVariables &&
      ruleInstance.logicEntityVariables.length > 0
    ) {
      // For the existing entity variables, make `key` and `entityKey` the same.
      // For newly created entity variables, `key` will be `entity:<id>`
      const newLogicEntityVariables = ruleInstance.logicEntityVariables.map(
        (v) =>
          v.entityKey
            ? v
            : {
                ...v,
                entityKey: v.key,
              }
      )
      await repo.createOrUpdateRuleInstance(
        {
          ...ruleInstance,
          logicEntityVariables: newLogicEntityVariables,
        },
        ruleInstance.updatedAt
      )
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

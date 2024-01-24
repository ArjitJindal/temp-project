import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })

  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()

  await Promise.all(
    ruleInstances.map(async (ruleInstance) => {
      const updatedRuleInstance = {
        ...ruleInstance,
        typology: undefined,
        typologyDescription: undefined,
        source: undefined,
        typologyGroup: undefined,
      } as RuleInstance

      await ruleInstanceRepository.createOrUpdateRuleInstance(
        updatedRuleInstance,
        updatedRuleInstance?.updatedAt
      )
    })
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

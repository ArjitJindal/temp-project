import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RuleRunMode } from '@/@types/openapi-internal/RuleRunMode'
import { RuleExecutionMode } from '@/@types/openapi-internal/RuleExecutionMode'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })

  const allRuleInstances = await ruleInstanceRepository.getAllRuleInstances()

  for (const ruleInstance of allRuleInstances) {
    const ruleRunMode = ruleInstance.mode?.split('_')[0] as RuleRunMode
    const ruleExecutionMode = ruleInstance.mode?.split(
      '_'
    )[1] as RuleExecutionMode

    await ruleInstanceRepository.createOrUpdateRuleInstance(
      {
        ...ruleInstance,
        ruleRunMode,
        ruleExecutionMode,
        mode: undefined,
      },
      ruleInstance.updatedAt
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

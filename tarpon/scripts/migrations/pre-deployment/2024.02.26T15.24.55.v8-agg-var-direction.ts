import { migrateAllTenants } from '../utils/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const tenantRepository = new TenantRepository(tenant.id, {
    dynamoDb,
  })
  const settings = await tenantRepository.getTenantSettings()
  if (!settings.features?.includes('RULES_ENGINE_V8')) {
    return
  }
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()
  for (const ruleInstance of ruleInstances) {
    const aggVars = ruleInstance.logicAggregationVariables ?? []
    for (const aggVar of aggVars) {
      aggVar.userDirection = 'SENDER_OR_RECEIVER'
      aggVar.transactionDirection = (aggVar as any).direction
      delete (aggVar as any).direction
    }
    if (aggVars.length > 0) {
      ruleInstance.logicAggregationVariables = aggVars
      await ruleInstanceRepository.createOrUpdateRuleInstance(
        ruleInstance,
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

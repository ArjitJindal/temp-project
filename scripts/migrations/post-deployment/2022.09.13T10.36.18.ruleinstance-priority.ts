import { migrateAllTenants } from '../utils/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Tenant } from '@/@types/openapi-internal/Tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  const dynamodb = await getDynamoDbClient()
  const ruleInstanceRepo = new RuleInstanceRepository(tenant.id, {
    dynamoDb: dynamodb,
  })
  const ruleInstances = await ruleInstanceRepo.getAllRuleInstances()
  for (const ruleInstance of ruleInstances) {
    console.log(`Migrate ruleInstance ${ruleInstance.id}`)
    ruleInstance.casePriority = 'P1'
    ruleInstance.caseCreationType = 'TRANSACTION'
    await ruleInstanceRepo.createOrUpdateRuleInstance(ruleInstance)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down = async () => {
  //skipped
}

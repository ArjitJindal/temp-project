import { migrateAllTenants } from '../utils/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getRuleByRuleId } from '@/services/rules-engine/transaction-rules/library'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const repo = new RuleInstanceRepository(tenant.id, { dynamoDb })
  const targetRuleInstances = (await repo.getAllRuleInstances()).filter(
    (r) => !r.type || !r.labels || !r.nature || !r.casePriority || !r.checksFor
  )
  for (const ruleInstance of targetRuleInstances) {
    const rule = getRuleByRuleId(ruleInstance.ruleId as string)
    const updatedRuleInstance = {
      ...ruleInstance,
      type: ruleInstance.type || rule.type,
      labels: ruleInstance.labels || rule.labels,
      nature: ruleInstance.nature || rule.defaultNature,
      casePriority: ruleInstance.casePriority || rule.defaultCasePriority,
      checksFor: ruleInstance.checksFor || rule.checksFor,
    }
    await repo.createOrUpdateRuleInstance(
      updatedRuleInstance,
      updatedRuleInstance.updatedAt
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = await getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const rules = await ruleInstanceRepository.getAllRuleInstances()
  const transactionsVelocityRule = rules.find((rule) => rule.ruleId === 'R-30')
  if (!transactionsVelocityRule) {
    return
  }
  const userIdsToCheck = Array.from(
    new Set([
      ...(transactionsVelocityRule.parameters?.userIdsToCheck ?? []),
      ...Object.values(
        transactionsVelocityRule.riskLevelParameters ?? {}
      ).flatMap((parameters) => parameters.userIdsToCheck ?? []),
    ])
  )
  if (userIdsToCheck.length > 0) {
    transactionsVelocityRule.filters = {
      ...transactionsVelocityRule.filters,
      userIds: [userIdsToCheck],
    }
    await ruleInstanceRepository.createOrUpdateRuleInstance(
      transactionsVelocityRule
    )
    console.log(`Migrated rule ${transactionsVelocityRule.id}`)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

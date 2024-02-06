import { migrateAllTenants } from '../utils/tenant'
import { deleteUnusedRuleParameter } from '../utils/rule'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()

  for (const ruleInstance of ruleInstances) {
    if (ruleInstance.ruleId === 'R155') {
      ruleInstance.parameters = {
        ...ruleInstance.parameters,
        initialTransactions: 0,
        allowedDistancePercentage: 0,
        ignoreEmptyName: true,
      }
      await ruleInstanceRepository.createOrUpdateRuleInstance(ruleInstance)
    }
  }
}

export const up = async () => {
  await deleteUnusedRuleParameter(
    ['bank-name-change'],
    [],
    ['oldBanksThreshold']
  )
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

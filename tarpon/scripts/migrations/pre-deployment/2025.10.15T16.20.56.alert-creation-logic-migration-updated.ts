import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/@types/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()

  for (const instance of ruleInstances) {
    if (instance.screeningAlertCreationLogic) {
      instance.alertCreationLogic =
        instance.screeningAlertCreationLogic === 'PER_SEARCH_ALERT'
          ? 'PER_COUNTERPARTY_ALERT'
          : instance.screeningAlertCreationLogic === 'SINGLE_ALERT'
          ? 'SINGLE_ALERT'
          : undefined

      await ruleInstanceRepository.createOrUpdateRuleInstance(instance)
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

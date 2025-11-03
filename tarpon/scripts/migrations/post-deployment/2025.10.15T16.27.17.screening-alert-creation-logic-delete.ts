import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/@types/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()
  for (const instance of ruleInstances) {
    if (instance.screeningAlertCreationLogic) {
      if (!instance.alertCreationLogic) {
        // means that the rule instance is not migrated yet
        instance.alertCreationLogic =
          instance.screeningAlertCreationLogic === 'PER_SEARCH_ALERT'
            ? 'PER_COUNTERPARTY_ALERT'
            : instance.alertCreationLogic === 'SINGLE_ALERT'
            ? 'SINGLE_ALERT'
            : undefined
      }

      instance.screeningAlertCreationLogic = undefined
      await ruleInstanceRepository.createOrUpdateRuleInstance(instance)
      logger.info(
        `Deleted screeningAlertCreationLogic for rule instance ${instance.id}`
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

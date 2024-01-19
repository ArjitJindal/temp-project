import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { AlertCreatedForEnum } from '@/services/rules-engine/utils/rule-parameter-schemas'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()
  for (const ruleInstance of ruleInstances) {
    if (ruleInstance.ruleId && ruleInstance.parameters?.createAlertFor) {
      await ruleInstanceRepository.createOrUpdateRuleInstance(
        {
          ...ruleInstance,
          alertConfig: {
            ...ruleInstance.alertConfig,
            alertCreatedFor: convertToAlertCreateFor(
              ruleInstance.parameters?.createAlertFor
            ),
          },
        },
        ruleInstance.updatedAt
      )
    }
  }
}

const convertToAlertCreateFor = (
  createAlertFor: 'INTERNAL_USER' | 'EXTERNAL_USER' | 'ALL'
): AlertCreatedForEnum[] => {
  switch (createAlertFor) {
    case 'INTERNAL_USER':
      return ['USER']
    case 'EXTERNAL_USER':
      return ['PAYMENT_DETAILS']
    case 'ALL':
      return ['USER', 'PAYMENT_DETAILS']
  }
}
export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

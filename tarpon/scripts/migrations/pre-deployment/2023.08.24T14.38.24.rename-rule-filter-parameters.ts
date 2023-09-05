import { isEmpty } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { renameRuleFilter } from '../utils/rule'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()

  const ruleRepository = new RuleInstanceRepository(tenant.id, { dynamoDb })

  const ruleInstances = await ruleRepository.getAllRuleInstances()

  const filteredRuleInstances = ruleInstances.filter((ruleInstance) => {
    const { filters } = ruleInstance
    if (
      isEmpty(filters?.transactionCountries) &&
      isEmpty(filters?.paymentFilters)
    ) {
      return false
    }
    return true
  })

  for (const ruleInstance of filteredRuleInstances) {
    const newRuleInstance: RuleInstance = {
      ...ruleInstance,
      id: await ruleRepository.getNewRuleInstanceId(),
      filters: {
        ...ruleInstance.filters,
        ...(!isEmpty(ruleInstance?.filters?.transactionCountries) && {
          destinationTransactionCountries:
            ruleInstance?.filters?.transactionCountries,
        }),
        ...(!isEmpty(ruleInstance?.filters?.paymentFilters) && {
          destinationPaymentFilters: ruleInstance?.filters?.paymentFilters,
        }),
      },
    }

    delete newRuleInstance.filters.transactionCountries
    delete newRuleInstance.filters.paymentFilters

    await ruleRepository.createOrUpdateRuleInstance(newRuleInstance)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
  await renameRuleFilter(
    'transactionCountries',
    'originTransactionCountries',
    (value) => value
  )
  await renameRuleFilter(
    'paymentFilters',
    'originPaymentFilters',
    (value) => value
  )
}
export const down = async () => {
  // skip
}

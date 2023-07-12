import { addRuleFiltersForTenant } from '../utils/rule'
import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()

  await Promise.all(
    ruleInstances.map(async (ruleInstance) => {
      const filters = ruleInstance.filters
      if (filters?.paymentMethods?.length) {
        const newFilters = {
          ...filters,
          paymentFilters: {
            paymentMethods: filters.paymentMethods,
            walletType: filters.walletType,
            cardIssuedCountries: filters.transactionCardIssuedCountries,
            cardPaymentChannels: filters.paymentChannels,
          },
        }
        if (ruleInstance.id) {
          await addRuleFiltersForTenant(
            tenant.id,
            [ruleInstance.id],
            newFilters
          )
        }
      }
      return
    })
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

import { migrateAllTenants } from '../utils/tenant'
import { addRuleFiltersForTenant } from '../utils/rule'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })

  const ruleInstances = (
    await ruleInstanceRepository.getAllRuleInstances()
  ).filter(
    (ruleInstance) =>
      ['R-30', 'R-8', 'R-7', 'R-2', 'R-3'].includes(ruleInstance.ruleId) &&
      ruleInstance.parameters.paymentChannel
  )

  for (const ruleInstance of ruleInstances) {
    const paymentChannels = [ruleInstance.parameters.paymentChannel as string]
    if (ruleInstance.id) {
      await addRuleFiltersForTenant(tenant.id, [ruleInstance.id], {
        paymentChannels,
      })
      console.log(
        `Added paymentChannels filter for tenant ${tenant.id} and ruleInstance ${ruleInstance.id}`
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

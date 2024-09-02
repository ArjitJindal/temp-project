import { RuleInstanceRepository } from '../../../src/services/rules-engine/repositories/rule-instance-repository'
import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts'

async function migrateTenant(tenant: Tenant) {
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb: getDynamoDbClient(),
  })
  const allRuleInstances = await ruleInstanceRepository.getAllRuleInstances()

  await Promise.all(
    allRuleInstances.map((ruleInstance) => {
      const logicAggregationVariables =
        ruleInstance.logicAggregationVariables?.map((aggVar) => ({
          ...aggVar,
          includeCurrentEntity: aggVar.aggregationFunc !== 'UNIQUE_VALUES',
        }))
      if (logicAggregationVariables) {
        return ruleInstanceRepository.createOrUpdateRuleInstance(
          {
            ...ruleInstance,
            logicAggregationVariables,
          },
          ruleInstance.updatedAt
        )
      }
    })
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

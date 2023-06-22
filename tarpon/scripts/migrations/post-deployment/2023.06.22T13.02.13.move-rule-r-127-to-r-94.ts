import _ from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { Tenant } from '@/services/accounts'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'

async function updateR127ToR94(tenant: Tenant) {
  const dynamoDb = await getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const ruleRepository = new RuleRepository(FLAGRIGHT_TENANT_ID, { dynamoDb })

  const ruleInstances = await (
    ruleInstanceRepository as RuleInstanceRepository
  ).getAllRuleInstances()
  for (const ruleInstance of ruleInstances) {
    if (ruleInstance.ruleId === 'R-127') {
      ruleInstance.ruleId = 'R-94'
      await (
        ruleInstanceRepository as RuleInstanceRepository
      ).createOrUpdateRuleInstance({
        ...ruleInstance,
      })
    }
  }
  await ruleRepository.deleteRule('R-127')
}

export const up = async () => {
  await migrateAllTenants(updateR127ToR94)
}

export const down = async () => {
  // Put your migration code for rolling back here. If not applicable, skip it.
}

import { MigrationFn } from 'umzug'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { getDynamoDbClient } from '@/utils/dynamodb'

const LEGACY_RULE_IDS = ['R-101', 'R-111']

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = await getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()

  for (const ruleInstance of ruleInstances) {
    if (
      LEGACY_RULE_IDS.includes(ruleInstance.ruleId) &&
      ruleInstance.id != undefined
    ) {
      await ruleInstanceRepository.deleteRuleInstance(ruleInstance.id)
      console.info(
        `Delete rule instance ${ruleInstance.ruleId} (${ruleInstance.id})`
      )
    }
  }
}

async function deleteUnusedRules() {
  const dynamoDb = await getDynamoDbClient()
  const ruleRepository = new RuleRepository(FLAGRIGHT_TENANT_ID, {
    dynamoDb,
  })
  for (const ruleId of LEGACY_RULE_IDS) {
    await ruleRepository.deleteRule(ruleId)
    console.info(`Deleted rule ${ruleId}`)
  }
}

export const up: MigrationFn = async () => {
  await migrateAllTenants(migrateTenant)
  await deleteUnusedRules()
}

export const down: MigrationFn = async () => {
  // skip
}

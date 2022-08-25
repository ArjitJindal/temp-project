import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '../utils/db'
import { getRulesById } from '../utils/rule'
import { Tenant } from '@/lambdas/phytoplankton-internal-api-handlers/services/accounts-service'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'

const R2_DUPLICATES = new Set(['R-112'])
const R30_DUPLICATES = new Set(['R-84', 'R-95', 'R-96', 'R-103'])
const R60_DUPLICATES = new Set(['R-109', 'R-110'])
const RULES_TO_DELETE = [...R2_DUPLICATES, ...R30_DUPLICATES, ...R60_DUPLICATES]

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = await getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()

  for (const ruleInstance of ruleInstances) {
    let newRuleId: string | null = null
    if (R30_DUPLICATES.has(ruleInstance.ruleId)) {
      newRuleId = 'R-30'
    } else if (R60_DUPLICATES.has(ruleInstance.ruleId)) {
      newRuleId = 'R-60'
    } else if (R2_DUPLICATES.has(ruleInstance.ruleId)) {
      newRuleId = 'R-2'
    }

    if (newRuleId) {
      await ruleInstanceRepository.createOrUpdateRuleInstance({
        ...ruleInstance,
        ruleId: newRuleId,
      })
      console.info(
        `Updated rule instance ${ruleInstance.ruleId} (${ruleInstance.id})`
      )
    }
  }
}

async function deleteUnusedRules() {
  const dynamoDb = await getDynamoDbClient()
  const rulesById = await getRulesById()
  const ruleRepository = new RuleRepository(FLAGRIGHT_TENANT_ID, {
    dynamoDb,
  })

  for (const ruleId of RULES_TO_DELETE) {
    if (rulesById[ruleId]) {
      await ruleRepository.deleteRule(ruleId)
      console.info(`Deleted rule ${ruleId}`)
    }
  }
}

migrateAllTenants(migrateTenant).then(deleteUnusedRules)
